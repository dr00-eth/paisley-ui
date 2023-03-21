import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';
import {
  LISTINGMENUITEMS as listingMenuItems,
  AREAMENUITEMS as areaMenuItems,
  FOLLOWUPMENUITEMS as followupMenuItems,
} from './constants'
import SmartMessageManager from './SmartMessageManager';
import {
  scrollToBottom,
  autoGrowTextarea,
  assignMessageIdToDisplayMessage,
  handleToggleFavorite,
  messageExists,
  resetChat,
  changeContext,
  handleMessage,
  userSelectedListing,
  userSelectedArea,
  userSelectedListingArea,
  handleEnhancePromptClick,
  toggleSwapVibe,
  handleTargetAudienceChange,
  handleToneChange,
  handleWritingStyleChange,
  formatKey
} from './helpers';
import { sendMessage, addMessage, getAgentProfile } from './utils';

class App extends Component {
  constructor(props) {
    super(props);
    this.messageManager = new SmartMessageManager();
    const searchParams = new URLSearchParams(window.location.search);
    this.state = {
      messages: this.messageManager.getMessages(),
      displayMessages: [],
      messageInput: '',
      userMessage: this.messageManager.userMessage,
      connection_id: '',
      context_id: 0,
      agentProfileUserId: searchParams.get('agentProfileUserId') || '',
      gptModel: searchParams.get('model') || 'gpt-3.5-turbo',
      isUserIdInputDisabled: searchParams.get('agentProfileUserId') ? true : false,
      isUserListingSelectDisabled: false,
      isUserAreaSelectDisabled: false,
      isLoading: false,
      showCopyNotification: {},
      selectedListingMlsID: '',
      selectedListingMlsNumber: '',
      selectedListingAreaId: '',
      agentName: '',
      agentProfileImage: '',
      listings: [],
      areas: [],
      areaUserListings: [],
      listingAreas: [],
      listingKitUrl: '',
      areaKitUrl: '',
      selectedAreaName: '',
      selectedListingAddress: '',
      incomingChatInProgress: false,
      messagesTokenCount: 0,
      isSwapVibeCollapsed: true,
    };
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
    this.textareaRef = React.createRef();
    this.workerUrl = 'https://paisley-proto.thegenie.ai.workers.dev'
    this.apiServerUrl = 'https://paisley-api-develop-9t7vo.ondigitalocean.app';
    //this.apiServerUrl = 'http://127.0.0.1:8008';
    if (this.apiServerUrl.startsWith('https')) {
      this.webSocketUrl = 'wss' + this.apiServerUrl.slice(5);
    } else {
      this.webSocketUrl = 'ws' + this.apiServerUrl.slice(4);
    }
  }

  componentDidMount() {
    this.socket = io(this.webSocketUrl, {
      pingInterval: 25000, //25 seconds
      pingTimeout: 60000 //60 seconds
    });
    //CONNECT
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id }, () => {
        fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`)
          .then(response => response.json())
          .then(() => {
            if (this.state.agentProfileUserId) {
              getAgentProfile(this);
            }
          })
          .catch(error => console.error(error));
      });
    });
    //MESSAGE
    this.socket.on('message', (data) => handleMessage(this, data));
    //EMIT_EVENT
    this.socket.on('emit_event', (data) => {
      const callbackData = { ...data.callback_data };
      if (this.state.messagesTokenCount > 4000) {
        callbackData.messages = this.messageManager.getMessages();
      }
      this.socket.emit('callback_event', data.callback_data);
      this.setState({ incomingChatInProgress: true });
    });
    //MESSAGE_COMPLETE
    this.socket.on('message_complete', (data) => {
      const messageId = this.messageManager.addMessage("assistant", data.message);
      assignMessageIdToDisplayMessage(this, data.message, messageId);
      this.setState({ incomingChatInProgress: false });
      this.textareaRef.current.focus();
    });
  }

  componentWillUnmount() {
    this.socket.off('message', this.handleMessage);
    this.socket.disconnect();
  }

  componentDidUpdate() {
    scrollToBottom(this);
  }

  render() {
    const {
      context_id,
      displayMessages,
      userMessage,
      listings,
      areas,
      listingAreas,
      isUserIdInputDisabled,
      isLoading,
      incomingChatInProgress,
      agentName,
      agentProfileImage,
      agentProfileUserId,
      selectedListingAreaId,
      isUserListingSelectDisabled,
      isUserAreaSelectDisabled,
      showCopyNotification,
      isSwapVibeCollapsed,
    } = this.state;

    const swapVibeSection = (
      <div className={`swap-vibe-section ${isSwapVibeCollapsed ? 'collapsed' : ''}`}>
        <div>
          <select className='Content-dropdown vibe' value={userMessage.writingStyle} onChange={(e) => handleWritingStyleChange(this, e)} id="writing-style">
            <option value="">--Select Writing Style--</option>
            <option value="luxury">Luxury</option>
            <option value="straightforward">Straightforward</option>
            <option value="professional">Professional</option>
          </select>
        </div>
        <div>
          <select className='Content-dropdown vibe' value={userMessage.tone} onChange={(e) => handleToneChange(this, e)} id="tone">
            <option value="">--Select Tone--</option>
            <option value="friendly">Friendly</option>
            <option value="conversational">Conversational</option>
            <option value="to_the_point">To the Point</option>
            <option value="emotional">Emotional</option>
          </select>
        </div>
        <div>
          <select className='Content-dropdown vibe' value={userMessage.targetAudience} onChange={(e) => handleTargetAudienceChange(this, e)} id="target-audience">
            <option value="">--Select Target Audience--</option>
            <option value="first_time_home_buyers">First-Time Home Buyers</option>
            <option value="sellers">Sellers</option>
            <option value="55plus">55+</option>
          </select>
        </div>
      </div>
    );

    const copyToClipboard = (text, index) => {
      const turndownService = new TurndownService();
      const markdown = turndownService.turndown(text);
      navigator.clipboard.writeText(markdown);

      this.setState(prevState => (
        {
          showCopyNotification: {
            ...prevState.showCopyNotification,
            [index]: true
          }
        }));
      setTimeout(() => {
        this.setState(prevState => (
          {
            showCopyNotification: {
              ...prevState.showCopyNotification,
              [index]: false
            }
          }));
      }, 3500);
    };

    const contextOptions = [
      { value: 0, label: 'Listing Focused' },
      { value: 1, label: 'Area Focused' },
      { value: 2, label: 'RE Coaching' },
      { value: 3, label: 'Follow Up' },
      { value: 4, label: 'ChatGPT'}
    ];

    const EnhanceButtons = (
      <button
        onClick={(e) => handleEnhancePromptClick(this, e)}
        disabled={isLoading || incomingChatInProgress || !userMessage.messageInput}
      >
        Enhance Prompt
      </button>
    );

    const contextItems = contextOptions.map((option, index) => {
      return (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      );
    });

    const listingButtons = listingMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={isLoading || incomingChatInProgress} value={option.value} onClick={async (e) => {
          const newUserMessage = { ...userMessage, messageInput: e.target.value };
          this.setState({ userMessage: newUserMessage }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;

            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }

            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }

            sendMessage(this, e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const startMessage = () => {
      return (
        <div>
          <p>Welcome to Paisley, your ultimate real estate productivity booster and colleague!</p>
          <p>To get started, simply type in your question or prompt in the chat bar on the bottom right of your screen. Whether you need help generating Facebook copy, creating a neighborhood guide, or writing a blog post, Paisley is here to assist you every step of the way.</p>
          <p>Need some inspiration? Here are a few example prompts to get your creative juices flowing:</p>
          <ul>
            <li>"Hey Paisley, can you help me write a blog post about the best schools in the area?"</li>
            <li>"Paisley, can you generate Facebook copy for my new listing?"</li>
            <li>"I need to create a neighborhood guide for the area. Can you help me get started, Paisley?"</li>
            <li>"Can you help me create a seller-focused marketing plan, Paisley?"</li>
            <li>"I'm looking to create a buyer-focused marketing campaign. Can you assist me, Paisley?"</li>
          </ul>
          <p>Don't forget, you can also use the menu on the left to switch between listing-focused, area-focused, coach Paisley, and follow-up Paisley. Additionally, quick action buttons are available on the menu bar to get you started on using Paisley as a jumping off point.</p>
          <p>So what are you waiting for? Let Paisley help take your real estate business to the next level.</p>
        </div>
        )
        };

    const areaButtons = areaMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={isLoading || incomingChatInProgress} value={option.value} onClick={async (e) => {
          const newUserMessage = { ...userMessage, messageInput: e.target.value };
          this.setState({ userMessage: newUserMessage }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;

            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }

            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }

            sendMessage(this, e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const followupButtons = followupMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={isLoading || incomingChatInProgress} value={option.value} onClick={async (e) => {
          const newUserMessage = { ...userMessage, messageInput: e.target.value };
          this.setState({ userMessage: newUserMessage }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;

            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }

            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }

            sendMessage(this, e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const messages = displayMessages.map((msg, index) => {
      const content = parse(msg.content, { renderer: new Renderer() });
      return (
        <div
          key={index}
          className={`chat-bubble ${msg.role === "user" ? "user" : "assistant"} ${msg.isKit ? "kit" : ""} ${msg.isFav ? "kit" : ""}`}
        >
          <div className="sender">{msg.role === "user" ? "Me:" : "Paisley:"}</div>
          <div className="message" dangerouslySetInnerHTML={{ __html: content }}></div>
          {msg.role === "user" && (msg.tone || msg.writingStyle || msg.targetAudience) && (
            <div className="user-message-details" style={{ fontStyle: 'italic', fontSize: 'small' }}>
              {msg.tone && <span>Tone: {formatKey(msg.tone)}</span>}
              {msg.tone && msg.writingStyle && <span>, </span>}
              {msg.writingStyle && <span>Writing Style: {formatKey(msg.writingStyle)}</span>}
              {(msg.tone || msg.writingStyle) && msg.targetAudience && <span>, </span>}
              {msg.targetAudience && <span>Target Audience: {formatKey(msg.targetAudience)}</span>}
            </div>
          )}

          {msg.role === "assistant" && (
            <button className='copy-icon' onClick={() => copyToClipboard(content, index)}>
              {showCopyNotification[index] ? 'Copied!' : 'Copy'}
            </button>
          )}
          {msg.role === "assistant" && msg.id && (
            <span
              className={`heart-icon ${msg.isFav ? "active" : ""}`}
              onClick={() => handleToggleFavorite(this, msg.id)}
            >
              ❤️
            </span>)}
        </div>
      );
    });


    return (
      <div className="App">
        <div id="loading-container" style={{ display: isLoading ? 'flex' : 'none' }}>
          <p>Loading...</p>
        </div>
        <div className="sidebar">
          <div className='sidebar-top'>
            <div className="sidebar-section">
              <h1 className="sidebar-title">TheGenie - Paisley</h1>
              <form className='user-form' onSubmit={(e) => getAgentProfile(this, e)}>
                {isUserIdInputDisabled === false && (
                  <input
                    type="text"
                    value={agentProfileUserId}
                    placeholder="Enter AspNetUserID"
                    onChange={(e) => this.setState({ agentProfileUserId: e.target.value })}
                    disabled={isUserIdInputDisabled}
                  />
                )}
                {isUserIdInputDisabled === false && (
                  <button
                    disabled={isUserIdInputDisabled}
                    type="submit">Save</button>
                )}
                <div className='agent-info'>
                  {agentProfileImage !== '' && (
                    <img className='agent-profile-image' alt={`Headshot of ${agentName}`} src={agentProfileImage} />
                  )}
                  {agentName !== '' && (
                    <h2 className='sidebar-subtitle'>
                      {agentName}
                    </h2>
                  )}
                </div>
              </form>
              {context_id === 0 && agentProfileUserId && listings.length > 0 && (
                <div className='sidebar-section listingSelectBox'>
                  <select ref={this.listingSelectRef} className='Content-dropdown' disabled={isUserListingSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedListing(this, e)}>
                    <option value="">-- Select Listing --</option>
                    {listings.map((listing, index) => (
                      <option key={index} value={`${listing.mlsID}_${listing.mlsNumber}`}>
                        {listing.mlsNumber} - {listing.streetNumber} {listing.streetName} {listing.unitNumber} ({listing.statusType})
                      </option>
                    ))}
                  </select>
                  {listingAreas.length > 0 && (
                    <select value={selectedListingAreaId} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedListingArea(this, e)}>
                      <option value="">-- Select Area --</option>
                      {listingAreas.map((area) => (
                        <option key={area.areaId} value={area.areaId}>
                          {area.areaName} ({area.areaType}) - {`${area.areaApnCount} properties`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {context_id === 1 && agentProfileUserId && areas.length > 0 && (
                <div className='sidebar-section areaSelectBox'>
                  <select ref={this.areaSelectRef} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedArea(this, e)}>
                    <option value="">-- Select Area --</option>
                    {areas.map((area, index) => (
                      <option key={index} value={area.areaId}>
                        {area.areaName} ({area.areaType}) {area.hasBeenOptimized ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-section quick-actions">
            <h2 className='sidebar-subheading'>QUICK ACTIONS</h2>
            <div className='menu-buttons'>
              {(() => {
                if (context_id === 0) {
                  return listingButtons;
                } else if (context_id === 1) {
                  return areaButtons;
                } else if (context_id === 3) {
                  return followupButtons;
                } else {
                  return 'No quick actions available for this context';
                }
              })()}
            </div>
          </div>
        </div>
        <div className='main-content'>
          <div id="chat-display" ref={this.chatDisplayRef}>
            {(() => {
              if (messages.length === 0) {
                if (context_id === 0) {
                  return startMessage();
                } else if (context_id === 1) {
                  return areas.length > 0
                    ? startMessage()
                    : "Hi, I'm Paisley! It looks like you haven't saved any areas in TheGenie yet. Please reach out to your Title Partner who shared the link with you to save areas for me to use.";
                } else if (context_id === 2) {
                  return "Hi, I'm Coach Paisley. Feel free to ask about anything real estate related!";
                } else if (context_id === 3) {
                  return "Hi, I'm The Ultimate Real Estate Follow Up Helper. I'm here to help you gameplan your marketing efforts and stay organized!";
                } else if (context_id === 4) {
                  return "Hi, I'm Paisley - in this context you can ask me anything you would like. I am not trained on any particular information and can answer questions about any topic."
                }
              } else {
                return messages;
              }
            })()}
          </div>
          {!this.state.isSwapVibeCollapsed && (
            <div className='swap-vibe-container'>
              {swapVibeSection}
            </div>
          )}
          <div id="chat-input">
            <select
              className='Context-dropdown'
              onChange={(e) => changeContext(this, e)}
              value={context_id}
              disabled={isLoading || incomingChatInProgress}
            >
              {contextItems}
            </select>
            <form onSubmit={(e) => sendMessage(this, e)}>
              <div className='chat-area'>
                <textarea
                  value={userMessage.messageInput}
                  ref={this.textareaRef}
                  className="chat-input-textarea"
                  onChange={(e) => {
                    const newUserMessage = { ...userMessage, messageInput: e.target.value };
                    this.setState({ userMessage: newUserMessage })
                  }}
                  onInput={() => autoGrowTextarea(this.textareaRef)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(this, e);
                    }
                  }}
                  placeholder="Enter your message..."
                  disabled={isLoading || incomingChatInProgress}
                />
                <button
                  className='send-button'
                  disabled={isLoading || incomingChatInProgress}
                  type="submit">
                  <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9"></polygon>
                  </svg>

                </button>
              </div>
              <div className='button-group'>
                {EnhanceButtons}
                <button onClick={(e) => toggleSwapVibe(this, e)}>Vibe</button>
                <button
                  disabled={isLoading || incomingChatInProgress}
                  onClick={(e) => resetChat(this, e)}>Reset Chat</button>
              </div>
            </form>
          </div>
          <div id="footer">
            <p>Agent to verify all information for accuracy and compliance before utilizing any content generated by Paisley</p>
            <p>Copyright © 2023 1parkplace, Inc. All rights reserved. - TheGenie.ai - US Patent #: 10,713,325</p>
          </div>
        </div>
      </div>
    );
  }
}
export default App;
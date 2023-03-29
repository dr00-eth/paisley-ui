import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import Autosuggest from 'react-autosuggest';
import Intercom from 'react-intercom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart as faSolidHeart, faBars } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faRegularHeart } from "@fortawesome/free-regular-svg-icons";

import { contextItems } from './contexts';
import {
  LISTINGMENUITEMS as listingMenuItems,
  AREAMENUITEMS as areaMenuItems,
  FOLLOWUPMENUITEMS as followupMenuItems,
  PRELISTINGMENUITEMS as prelistingMenuItems,
} from './constants';
import SmartMessageManager from './SmartMessageManager';
import {
  scrollToBottom,
  autoGrowTextarea,
  assignMessageIdToDisplayMessage,
  handleToggleFavorite,
  changeContext,
  handleMessage,
  userSelectedListing,
  userSelectedArea,
  userSelectedListingArea,
  handleEnhancePromptClick,
  toggleSwapVibe,
  toggleSidebarCollapse,
  handleTargetAudienceChange,
  handleToneChange,
  handleWritingStyleChange,
  formatKey,
  getConversations,
  userSelectedConversation,
  updateConversation,
  showLoading,
  hideLoading,
  createButtons,
  startMessage
} from './helpers';
import { sendMessage, getAgentProfile, onSuggestionsClearRequested, onSuggestionsFetchRequested, getSuggestionValue, renderSuggestion, autoSuggestOnChange } from './utils';

class CustomRenderer extends Renderer {
  link(href, title, text) {
    return `<a href="${href}" target="_blank" title="AI Generated Link to Resource">${text}</a>`;
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.messageManager = new SmartMessageManager();
    this.MySwal = withReactContent(Swal);
    const searchParams = new URLSearchParams(window.location.search);
    this.state = {
      appVersion: '',
      messages: this.messageManager.messages,
      displayMessages: [],
      messageInput: '',
      userMessage: this.messageManager.userMessage,
      deletedMessages: this.messageManager.deletedMsgs,
      connection_id: '',
      context_id: 0,
      agentProfileUserId: searchParams.get('agentProfileUserId') || '',
      privateMode: searchParams.get('privateMode') ?? false,
      debug: searchParams.get('debug') ?? false,
      gptModel: searchParams.get('model') || 'gpt-3.5-turbo',
      isUserIdInputDisabled: searchParams.get('agentProfileUserId') ? true : false,
      isUserListingSelectDisabled: false,
      isUserAreaSelectDisabled: false,
      isAddressSearchDisabled: false,
      isLoading: false,
      isWaitingForMessages: false,
      showCopyNotification: {},
      selectedAreaId: 0,
      selectedListingMlsID: '',
      selectedListingMlsNumber: '',
      selectedListingAreaId: '',
      addressSearchString: '',
      addressSuggestions: [],
      foundProperties: [],
      selectedProperty: [],
      agentName: '',
      agentProfileImage: '',
      accountEmail: '',
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
      conversations: [],
      conversationsList: [],
      currentConversation: '',
      isMenuCollapsed: false,
    };
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
    this.textareaRef = React.createRef();
    this.alertTimeout = null;
    this.updateInterval = null;
    this.workerUrl = 'https://paisleystate.thegenie.workers.dev/'
    this.apiServerUrl = 'https://paisley-api-develop-9t7vo.ondigitalocean.app';
    //this.apiServerUrl = 'http://127.0.0.1:8008';
    if (this.apiServerUrl.startsWith('https')) {
      this.webSocketUrl = 'wss' + this.apiServerUrl.slice(5);
    } else {
      this.webSocketUrl = 'ws' + this.apiServerUrl.slice(4);
    }
  }

  componentDidMount() {
    this.handleUpdateAvailable = this.showUpdateAlert.bind(this);
    this.updateInterval = setInterval(async () => {
      const latestVersion = await this.fetchLatestVersion();
      if (latestVersion && this.state.appVersion !== latestVersion) {
        this.setState({ appVersion: latestVersion });
        this.showUpdateAlert();
      }
    }, 30000);

    this.socket = io(this.webSocketUrl, {
      pingInterval: 25000, //25 seconds
      pingTimeout: 60000 //60 seconds
    });
    //CONNECT
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id }, () => {
        fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`)
          .then(async response => await response.json())
          .then(async (data) => {
            const latestVersion = await this.fetchLatestVersion();
            await this.setStateAsync({ appVersion: latestVersion })
            for (const message of data) {
              this.messageManager.addMessage(message.role, message.content, true);
            }
            if (this.state.agentProfileUserId) {
              showLoading(this);
              await getAgentProfile(this);
              hideLoading(this);
              const { modifiedStates, states } = await getConversations(this, this.state.agentProfileUserId); // eslint-disable-line no-unused-vars
              await this.setStateAsync({ conversationsList: modifiedStates, conversations: states });
            }
          })
          .catch(error => console.error(error));
      });
    });
    //RECEIVE MESSAGE
    this.socket.on('message', (data) => {
      handleMessage(this, data);
    });
    //ASK FOR MESSAGES
    this.socket.on('emit_msgs_event', (data) => {
      const callbackData = { ...data.callback_data };
      callbackData.messages = this.messageManager.getMessagesSimple();
      if (Boolean(this.state.debug) === true) {
        console.log(callbackData.messages);
      }
      this.socket.emit('callback_msgs_event', callbackData);
      this.setState({ incomingChatInProgress: true, isWaitingForMessages: true });

      // set a timer to show an alert if no messages are received within 5 seconds
      this.alertTimeout = setTimeout(() => {
        if (this.state.isWaitingForMessages) {
          this.MySwal.fire({
            title: 'Please be patient',
            text: 'We\'re experiencing heavy use right now. Hang tight!',
            icon: 'info',
            toast: true,
            timerProgressBar: true,
            position: 'bottom-end', // set the position of the toast notification
            showConfirmButton: false, // hide the confirmation button
            timer: 5000 // set the duration of the toast notification to 5 seconds
          });
        }
      }, 4000);
    });
    //MESSAGE_COMPLETE
    this.socket.on('message_complete', async (data) => {
      const messageId = this.messageManager.addMessage("assistant", data.message);
      await assignMessageIdToDisplayMessage(this, data.message, messageId);
      await updateConversation(this);
      if (Boolean(this.state.debug) === true) {
        console.log(this.messageManager.messages);
      }
      await this.setStateAsync({ messages: this.messageManager.messages, incomingChatInProgress: false });
      this.textareaRef.current.focus();
    });

    if (!this.state.privateMode) {
      // Load Hotjar tracking code
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://static.hotjar.com/c/hotjar-3409222.js?sv=6`;
      document.head.appendChild(script);
    }
  }

  async fetchLatestVersion() {
    try {
      const response = await fetch('/version.json');
      const data = await response.json();
      return data.version;
    } catch (error) {
      console.error('Error fetching latest version:', error);
      return null;
    }
  }

  showUpdateAlert() {
    this.MySwal.fire({
      title: 'New version available',
      text: 'A new version of the app is available. Please refresh the page to get the latest updates.',
      icon: 'info',
      confirmButtonText: 'Refresh',
      showCancelButton: false,
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });
  }

  componentWillUnmount() {
    this.socket.off('message', this.handleMessage);
    this.socket.disconnect();
  }

  componentDidUpdate() {
    scrollToBottom(this);
  }

  setStateAsync = function (newState) {
    return new Promise((resolve) => {
      this.setState(newState, resolve);
    });
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
      selectedAreaId,
      isUserListingSelectDisabled,
      isUserAreaSelectDisabled,
      showCopyNotification,
      isSwapVibeCollapsed,
      isMenuCollapsed,
      conversationsList,
      currentConversation,
      selectedListingMlsID,
      selectedListingMlsNumber,
      addressSearchString,
      addressSuggestions,
      isAddressSearchDisabled
    } = this.state;

    const swapVibeSection = (
      <div className={`swap-vibe-section ${isSwapVibeCollapsed ? 'collapsed' : ''}`}>
        <div>
          <select className='Content-dropdown vibe' value={userMessage.writingStyle} onChange={(e) => handleWritingStyleChange(this, e)} id="writing-style">
            <option value="">--Select Writing Style--</option>
            <option value="luxury">Luxury</option>
            <option value="straightforward">Straightforward</option>
            <option value="professional">Professional</option>
            <option value="creative">Creative</option>
            <option value="persuasive">Persuasive</option>
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
            <option value="empty_nesters">Empty Nesters</option>
            <option value="investor">Investor</option>
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

    const EnhanceButtons = (
      <button
        onClick={(e) => {
          e.preventDefault();
          if (isLoading || incomingChatInProgress || !userMessage.messageInput) {
            this.MySwal.fire({
              title: 'Enhance Prompt',
              text: 'You must first type a prompt before you can enhance!',
              icon: 'warning',
              confirmButtonText: 'OK'
            });
          } else {
            handleEnhancePromptClick(this, e)
          }
        }
        }
      >
        Enhance Prompt
      </button>
    );

    const listingButtons = createButtons(this, listingMenuItems, userMessage, isLoading, incomingChatInProgress);
    const areaButtons = createButtons(this, areaMenuItems, userMessage, isLoading, incomingChatInProgress);
    const followupButtons = createButtons(this, followupMenuItems, userMessage, isLoading, incomingChatInProgress);
    const prelistingButtons = createButtons(this, prelistingMenuItems, userMessage, isLoading, incomingChatInProgress);

    const messages = displayMessages.map((msg, index) => {
      let content = '';
      try {
        content = parse(msg.content, { renderer: new CustomRenderer() });
      } catch (error) {
        console.error(error);
      }

      return (
        <div
          key={index}
          className={`chat-bubble ${msg.role === "user" ? "user" : "assistant"} ${msg.isKit ? "kit" : ""} ${msg.isFav ? "favorite" : ""}`}
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
              <FontAwesomeIcon icon={msg.isFav ? faSolidHeart : faRegularHeart} />
            </span>
          )}
        </div>
      );
    });

    return (
      <div className={`App ${isMenuCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div id="loading-container" style={{ display: isLoading ? 'flex' : 'none' }}>
          <p>Learning...</p>
        </div>
        <div className={`sidebar ${isMenuCollapsed ? 'collapsed' : ''}`}>
          <div className="hamburger-menu" onClick={(e) =>
            toggleSidebarCollapse(this, e)
          }>
            <FontAwesomeIcon icon={faBars} size="lg" />
          </div>
          <div className='sidebar-top'>
            <div className="sidebar-section">
              <img className='logo' alt='logo of thegenie real estate marketing system' src='/static/img/thegenie-logo-white.png' />
              <form
                className='user-form'
                onSubmit={(e) => {
                  showLoading(this);
                  getAgentProfile(this, e);
                  hideLoading(this);
                }}>
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
                  <select ref={this.listingSelectRef} value={`${selectedListingMlsID}_${selectedListingMlsNumber}`} className='Content-dropdown' disabled={isUserListingSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedListing(this, e)}>
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
                  <select value={selectedAreaId} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedArea(this, e)}>
                    <option value="">-- Select Area --</option>
                    {areas.map((area) => (
                      <option key={area.areaId} value={area.areaId}>
                        {area.areaName} ({area.areaType}) {area.hasBeenOptimized ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {context_id === 5 && agentProfileUserId && (
                <div className='sidebar-section addressSearchBox'>
                  <Autosuggest
                    suggestions={addressSuggestions}
                    onSuggestionsFetchRequested={(value) => onSuggestionsFetchRequested(value, this)}
                    onSuggestionsClearRequested={() => onSuggestionsClearRequested(this)}
                    getSuggestionValue={getSuggestionValue}
                    renderSuggestion={(value) => renderSuggestion(value, this)}
                    inputProps={{
                      disabled: isAddressSearchDisabled,
                      placeholder: 'Enter an address',
                      value: addressSearchString,
                      onChange: (event, { newValue }) => autoSuggestOnChange(event, { newValue }, this),
                    }}
                  />
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
            </div>
          </div>
          <div className="sidebar-section quick-actions">
            <h2 className='sidebar-subheading'>QUICK ACTIONS</h2>
            {((context_id === 0) || (context_id === 1) || (context_id === 3) || (context_id === 5)) && (
              <div className='menu-buttons'>
                {(() => {
                  if (context_id === 0) {
                    return listingButtons;
                  } else if (context_id === 1) {
                    return areaButtons;
                  } else if (context_id === 3) {
                    return followupButtons;
                  } else if (context_id === 5) {
                    return prelistingButtons;
                  }
                })()}
              </div>
            )}

            {!((context_id === 0) || (context_id === 1) || (context_id === 3) || (context_id === 5)) && (
              <div className='no-actions'>
                No quick actions available
              </div>
            )}

          </div>
        </div>
        <div className={`main-content ${isMenuCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div id="conversation-select">
            <select ref={this.conversationSelectRef} value={currentConversation} className='Content-dropdown' disabled={incomingChatInProgress} onChange={(e) => userSelectedConversation(this, e)}>
              <option value="">Conversation History</option>
              {conversationsList.length === 0 && (
                <option value=''>
                  -- No Conversations --
                </option>
              )}
              {conversationsList.length > 0 && conversationsList.map((conversation, index) => (
                <option key={index} value={conversation.id}>
                  {conversation.name}
                </option>
              ))}
            </select>
            {!(this.state.privateMode) && (
              <Intercom
                appID="m7py7ex5"
                name={this.state.agentName}
                email={this.state.accountEmail}
                alignment="right"
                vertical_padding={20}
              />
            )}
          </div>
          <hr></hr>
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
          <hr></hr>
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
            <form onSubmit={async (e) => {
              if (userMessage.messageInput === '') {
                this.MySwal.fire({
                  title: 'Prompt',
                  text: 'Type a prompt before trying to chat!',
                  icon: 'warning',
                  confirmButtonText: 'OK'
                });
              } else {
                await sendMessage(this, e);
              }

            }
            }>
              <div className='chat-area'>
                <textarea
                  value={userMessage.messageInput}
                  ref={this.textareaRef}
                  className="chat-input-textarea"
                  onChange={async (e) => {
                    const newUserMessage = { ...userMessage, messageInput: e.target.value };
                    await this.setStateAsync({ userMessage: newUserMessage });
                  }}
                  onInput={() => autoGrowTextarea(this.textareaRef)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (e.target.value === '') {
                        this.MySwal.fire({
                          title: 'Prompt',
                          text: 'Type a prompt before trying to chat!',
                          icon: 'warning',
                          confirmButtonText: 'OK'
                        });
                      } else {
                        await sendMessage(this, e);
                      }
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
                {/* <button
                  disabled={isLoading || incomingChatInProgress}
                  onClick={async (e) => await resetConversation(this, e)}>Reset Chat</button> */}
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
import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
      displayMessages: [],
      messageInput: '',
      connection_id: '',
      context_id: 0
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.chatDisplayRef = React.createRef();
    this.apiServerUrl = 'http://127.0.0.1:8008'
  }

  componentDidMount() {
    this.socket = io(this.apiServerUrl);
    this.socket.on('message', this.handleMessage);
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id}, () => {
        fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`)
          .then(response => response.json())
          .then(data => {
            const messages = data.map(msg => ({ role: msg.role, content: msg.content }));
            this.setState({ messages: messages });
          })
          .catch(error => console.error(error));
      });
    });
  }
  
  componentWillUnmount() {
    this.socket.off('message', this.handleMessage);
    this.socket.disconnect();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  changeContext(event) {
    const newContextId = event.target.value;
    this.setState({ context_id: newContextId, messages: [], displayMessages: [] });
    fetch(`${this.apiServerUrl}/api/getmessages/${newContextId}/${this.state.connection_id}`)
          .then(response => response.json())
          .then(data => {
            const messages = data.map(msg => ({ role: msg.role, content: msg.content }));
            this.setState({ messages: messages });
          })
          .catch(error => console.error(error));
  }

  handleMessage(data) {
    const messages = this.state.messages.slice();
    const displayMessages = this.state.displayMessages.slice();
    const latestMsg = messages[messages.length - 1];
    const latestDisplayMsg = displayMessages[displayMessages.length - 1];
    if (latestMsg && latestMsg.role === "assistant" && latestDisplayMsg && latestDisplayMsg.role === "assistant") {
      // Append incoming message to the latest assistant message
      latestMsg.content += data.message;
      latestDisplayMsg.content += data.message;
    } else {
      // Add a new assistant message with the incoming message
      messages.push({ role: "assistant", content: data.message });
      displayMessages.push({ role: "assistant", content: data.message })
    }
    this.setState({ messages: messages, displayMessages: displayMessages });
  }

  sendMessage(event) {
    event.preventDefault();
    if (this.state.messageInput) {
      const messages = [...this.state.messages];
      const displayMessages = [...this.state.displayMessages];
      messages.push({
        role: 'user',
        content: this.state.messageInput
      });
      displayMessages.push({
        role: 'user',
        content: this.state.messageInput
      });
      this.setState({ messages, displayMessages, messageInput: '' });
  
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: this.state.messageInput, user_id: this.state.connection_id, context_id: this.state.context_id })
      };
      fetch(`${this.apiServerUrl}/api/messages`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to send message');
          }
        })
        .catch(error => console.error(error));
    }
  }  

  resetChat(event) {
    event.preventDefault();
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.state.connection_id, context_id: this.state.context_id })
    };
    fetch(`${this.apiServerUrl}/api/newchat`, requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to reset chat');
        }
        this.setState({ messages: [], displayMessages: [] });
      })
      .catch(error => console.error(error));
  }
  
  scrollToBottom() {
    if (this.chatDisplayRef.current) {
      this.chatDisplayRef.current.scrollTop = this.chatDisplayRef.current.scrollHeight;
    }
  }

  render() {
    const contextOptions = [
      { value: 0, label: 'Listing Marketing' },
      { value: 1, label: 'Area Marketing' },
    ];

    const dropdownItems = contextOptions.map((option, index) => {
      return (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      );
    });

    const messages = this.state.displayMessages.map((msg, index) => (
      <div
        key={index}
        className={`chat-bubble ${msg.role === "user" ? "user" : "assistant"}`}
      >
        <div className="sender">{msg.role === "user" ? "Me:" : "Paisley:"}</div>
        <div className="message">{msg.content}</div>
      </div>
    ));
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">TheGenie - Paisley Chat</h1>
          <select className='Content-dropdown' onChange={this.changeContext} value={this.state.context_id}>
            {dropdownItems}
          </select>
        </header>
        <div id="chat-display" ref={this.chatDisplayRef}>
          {messages.length > 0 ? (
            messages
          ) : (
            <p>No messages yet</p>
          )}
        </div>
        <div id="chat-input">
          <form onSubmit={this.sendMessage}>
            <input
              value={this.state.messageInput}
              onChange={(e) => this.setState({ messageInput: e.target.value })}
              type="text"
              placeholder="Enter your message..."
            />
            <button type="submit">Send</button>
            <button onClick={this.resetChat}>Reset Chat</button>
          </form>
        </div>
      </div>
    );
  }
}

export default App;

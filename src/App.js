import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
      messageInput: '',
      connection_id: ''
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.chatDisplayRef = React.createRef();
  }

  componentDidMount() {
    this.socket = io('https://paisley-api-naqoz.ondigitalocean.app/');
    this.socket.on('message', this.handleMessage);
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id}, () => {
        fetch(`https://paisley-api-naqoz.ondigitalocean.app/api/getmessages/${this.state.connection_id}`)
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

  handleMessage(data) {
    const messages = this.state.messages.slice();
    const latestMsg = messages[messages.length - 1];
    if (latestMsg && latestMsg.role === "assistant") {
      // Append incoming message to the latest assistant message
      latestMsg.content += data.message;
    } else {
      // Add a new assistant message with the incoming message
      messages.push({ role: "assistant", content: data.message });
    }
    this.setState({ messages: messages });
  }

  sendMessage(event) {
    event.preventDefault();
    if (this.state.messageInput) {
      const messages = [...this.state.messages];
      messages.push({
        role: 'user',
        content: this.state.messageInput
      });
      this.setState({ messages, messageInput: '' });
  
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: this.state.messageInput, connection_id: this.state.connection_id })
      };
      fetch('https://paisley-api-naqoz.ondigitalocean.app/api/messages', requestOptions)
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
      body: JSON.stringify({ connection_id: this.state.connection_id })
    };
    fetch('https://paisley-api-naqoz.ondigitalocean.app/api/newchat', requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to reset chat');
        }
        this.setState({ messages: [] });
      })
      .catch(error => console.error(error));
  }
  
  scrollToBottom() {
    if (this.chatDisplayRef.current) {
      this.chatDisplayRef.current.scrollTop = this.chatDisplayRef.current.scrollHeight;
    }
  }

  render() {
    const messages = this.state.messages.map((msg, index) => (
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
          <h1 className="App-title">StreamBot Chat</h1>
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

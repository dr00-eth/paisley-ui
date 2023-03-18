// messageManager.js
const { v4: uuidv4 } = require('uuid');

class SmartMessageManager {
  constructor() {
    this.deletedMsgs = [];
    this.messages = [];
  }

  addMessage(role, content, isFav = false) {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = {
      id: uuidv4(),
      role,
      content,
      isFav: isFav,
      timestamp,
    };

    this.messages.push(message);
    return message.id;
  }

  checkThresholdAndMove(thresholdHours) {
    const threshold = thresholdHours * 60 * 60; // Convert hours to seconds
    const now = Math.floor(Date.now() / 1000);

    this.messages = this.messages.filter((message) => {
      if (now - message.timestamp > threshold && !message.isFav) {
        this.deletedMsgs.push({
          on: Math.floor(Date.now() / 1000),
          role: message.role,
          content: message.content,
          wasFav: message.isFav,
        });
        return false;
      }
      return true;
    });
  }

  toggleFavorite(id) {
    this.messages = this.messages.map((message) => {
      if (message.id === id) {
        message.isFav = !message.isFav;
      }
      return message;
    });
  }

  getMessages() {
    return this.messages.map(({ role, content }) => ({ role, content }));
  }

  resetMessages() {
    this.deletedMsgs = [];
    this.messages = [];

    return this.messages;
  }
}

module.exports = SmartMessageManager;

import { v4 as uuidv4 } from 'uuid';
import UserMessage from './UserMessage';

class SmartMessageManager {
  constructor() {
    this.deletedMsgs = [];
    this.messages = [];
    this.userMessage = new UserMessage();
  }

  resetUserMessage() {
    this.userMessage = new UserMessage();
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
  
    // Find the oldest message matching the criteria
    let oldestMessage = null;
    this.messages.forEach((message) => {
      if (now - message.timestamp > threshold && message.role === 'assistant' && !message.isFav) {
        if (!oldestMessage || message.timestamp < oldestMessage.timestamp) {
          oldestMessage = message;
        }
      }
    });
  
    // If an oldest message is found, remove it from messages and add it to deletedMsgs
    if (oldestMessage) {
      this.messages = this.messages.filter((message) => message !== oldestMessage);
      this.deletedMsgs.push({
        deletedOn: Math.floor(Date.now() / 1000),
        role: oldestMessage.role,
        content: oldestMessage.content,
        originalTimestamp: oldestMessage.timestamp,
      });
    }
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

export default SmartMessageManager;

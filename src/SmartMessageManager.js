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

  async getTokenCountForMessage(context, message) {
    const tokenChkBody = {
      messages: [{ role: message.role, content: message.content }],
      model: context.state.gptModel,
    };
  
    const tokenChkReq = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenChkBody),
    };
  
    const response = await fetch(`${context.apiServerUrl}/api/gettokencount`, tokenChkReq);
    const data = await response.json();
    return data.tokencounts;
  }
  
  async checkThresholdAndMove(context, currentTokenCount) {
    const maxTokenCount = 3000;
    const pruneToTokenCount = 2500;
  
    if (currentTokenCount > maxTokenCount) {
      // Prune messages until token count is below pruneToTokenCount
      while (currentTokenCount > pruneToTokenCount) {
        let oldestMessage = null;
  
        // Find the oldest message matching the criteria
        for (const message of context.messageManager.messages) {
          if (message.role === 'assistant' && !message.isFav) {
            if (!oldestMessage || message.timestamp < oldestMessage.timestamp) {
              oldestMessage = message;
            }
          }
        }
  
        // If an oldest message is found, remove it from messages and add it to deletedMsgs
        if (oldestMessage) {
          const oldestMessageTokenCount = await this.getTokenCountForMessage(context, oldestMessage);
          context.messageManager.messages = context.messageManager.messages.filter((message) => message !== oldestMessage);
          context.messageManager.deletedMsgs.push({
            deletedOn: Math.floor(Date.now() / 1000),
            role: oldestMessage.role,
            content: oldestMessage.content,
            originalTimestamp: oldestMessage.timestamp,
          });
  
          // Update the current token count
          currentTokenCount -= oldestMessageTokenCount;
        } else {
          break;
        }
      }
      context.setStateAsync({ messages: context.messageManager.messages });
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

  getMessagesSimple() {
    return this.messages.map(({ role, content }) => ({ role, content }));
  }

  resetMessages() {
    this.deletedMsgs = [];
    this.messages = [];

    return this.messages;
  }

  cleanMessages() {
    this.deletedMsgs = [];
    this.messages = this.messages.filter((message) => message.isFav);
    return this.messages;
  }
}

export default SmartMessageManager;

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

  async checkThresholdAndMove(currentTokenCount, roleName, currentMessage, gptModel, context) {
    const maxTokenCount = 3000;
    const pruneToTokenCount = 2500;
  
    if (currentTokenCount > maxTokenCount) {
      // Get the token count of the current message
      const tokenChkBody = {
        messages: { role: roleName, content: currentMessage },
        model: gptModel
      };
  
      const tokenChkReq = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenChkBody)
      };
  
      const response = await fetch(`${context.apiServerUrl}/api/gettokencount`, tokenChkReq);
      const data = await response.json();
      const currentMessageTokenCount = data.tokencounts;
      
  
      // Prune messages until token count is below pruneToTokenCount
      while (currentTokenCount > pruneToTokenCount) {
        let oldestMessage = null;
        let oldestMessageTokenCount = 0;
  
        // Find the oldest message matching the criteria
        for (const message of context.messageManager.messages) {
          if (message.role === 'assistant' && !message.isFav) {
            if (!oldestMessage || message.timestamp < oldestMessage.timestamp) {
              oldestMessage = message;
              oldestMessageTokenCount = message.tokenCount;
            }
          }
        }
  
        // If an oldest message is found, remove it from messages and add it to deletedMsgs
        if (oldestMessage) {
          context.messageManager.messages = context.messageManager.messages.filter((message) => message !== oldestMessage);
          context.deletedMsgs.push({
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
}

export default SmartMessageManager;

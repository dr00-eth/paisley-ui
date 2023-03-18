import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';
import { LISTINGMENUITEMS as listingMenuItems, AREAMENUITEMS as areaMenuItems, FOLLOWUPMENUITEMS as followupMenuItems } from './constants'
import SmartMessageManager from './SmartMessageManager';

class App extends Component {
  constructor(props) {
    super(props);
    this.messageManager = new SmartMessageManager();
    const searchParams = new URLSearchParams(window.location.search);
    this.state = {
      messages: this.messageManager.getMessages(),
      displayMessages: [],
      messageInput: '',
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
      listingAreas: [],
      listingKitUrl: '',
      areaKitUrl: '',
      selectedAreaName: '',
      selectedListingAddress: '',
      incomingChatInProgress: false,
      messagesTokenCount: 0
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.getAgentProfile = this.getAgentProfile.bind(this);
    this.getPropertyProfile = this.getPropertyProfile.bind(this);
    this.getListingAreas = this.getListingAreas.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.userSelectedListing = this.userSelectedListing.bind(this);
    this.userSelectedArea = this.userSelectedArea.bind(this);
    this.userSelectedListingArea = this.userSelectedListingArea.bind(this);
    this.generateListingKit = this.generateListingKit.bind(this);
    this.generateAreaKit = this.generateAreaKit.bind(this);
    this.waitForIncomingChatToFinish = this.waitForIncomingChatToFinish.bind(this);
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
    this.textareaRef = React.createRef();
    //this.apiServerUrl = 'https://paisley-api-develop-9t7vo.ondigitalocean.app';
    this.apiServerUrl = 'http://127.0.0.1:8008';
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
    this.socket.on('message', this.handleMessage);
    this.socket.on('emit_event', (data) => {
      const callbackData = {...data.callback_data};
      if (this.state.messagesTokenCount > 4000) {
        callbackData.messages = this.messageManager.getMessages();
      }

      // call the callback function with the data provided by the server
      this.socket.emit('callback_event', data.callback_data);
      this.setState({ incomingChatInProgress: true });
    });
    this.socket.on('message_complete', (data) => {
      const messageId = this.messageManager.addMessage("assistant", data.message);
      this.assignMessageIdToDisplayMessage(data.message, messageId);
      this.setState({ incomingChatInProgress: false });
      this.textareaRef.current.focus();
      console.log(this.messageManager.messages);
    });    
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id }, () => {
        fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`)
          .then(response => response.json())
          .then(() => {
            if (this.state.agentProfileUserId) {
              this.getAgentProfile();
            }
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

  updateDisplayMessagesWithFavorites() {
    const updatedDisplayMessages = this.state.displayMessages.map(msg => {
      const updatedMessage = this.state.messages.find(m => m.id === msg.id);
      return updatedMessage ? updatedMessage : msg;
    });
    this.setState({ displayMessages: updatedDisplayMessages });
  }

  assignMessageIdToDisplayMessage(content, messageId) {
    const updatedDisplayMessages = this.state.displayMessages.map(msg => {
      if (msg.content === content) {
        return { ...msg, id: messageId };
      }
      return msg;
    });
    this.setState({ displayMessages: updatedDisplayMessages });
  }
  
  messageExists(role, content) {
    const messages = this.messageManager.getMessages();
    return messages.some(message => message.role === role && message.content === content);
  }  

  handleToggleFavorite(id) {
    this.messageManager.toggleFavorite(id);
    this.setState({ messages: this.messageManager.getMessages() }, () => {
      this.updateDisplayMessagesWithFavorites();
    });
    console.log(this.messageManager.messages);
  }

  showLoading() {
    this.setState({ isLoading: true });
  }

  hideLoading() {
    this.setState({ isLoading: false });
  }

  scrollToBottom() {
    if (this.chatDisplayRef.current) {
      this.chatDisplayRef.current.scrollTop = this.chatDisplayRef.current.scrollHeight;
    }
  }

  autoGrowTextarea = () => {
    const textarea = this.textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async waitForIncomingChatToFinish() {
    while (this.state.incomingChatInProgress) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  changeContext(event) {
    const newContextId = parseInt(event.target.value);
    this.setState({ context_id: newContextId, messages: this.messageManager.resetMessages(), displayMessages: [] });
    fetch(`${this.apiServerUrl}/api/getmessages/${newContextId}/${this.state.connection_id}`)
      .then(response => response.json())
      .then(() => {
        if (newContextId === 2 || newContextId === 3) {
          this.getAgentProfile();
        }
      })
      .catch(error => console.error(error));
  }

  handleMessage(data) {
    const displayMessages = this.state.displayMessages.slice();
    const latestDisplayMsg = displayMessages[displayMessages.length - 1];
    if (latestDisplayMsg && latestDisplayMsg.role === "assistant") {
      // Append incoming message to the latest assistant message
      latestDisplayMsg.content += data.message;
    } else {
      // Add a new assistant message with the incoming message
      displayMessages.push({ role: "assistant", content: data.message, isFav: false })
    }
    this.setState({ displayMessages: displayMessages });
  }

  async sendMessage(event) {
    event.preventDefault();
    if (this.state.messageInput) {
      const messageId = this.messageManager.addMessage("user", this.state.messageInput);
      const displayMessages = [...this.state.displayMessages];
      
      displayMessages.push({
        role: 'user',
        content: this.state.messageInput,
        id: messageId,
        isFav: false
      });

      const requestBody = {
        message: this.state.messageInput,
        user_id: this.state.connection_id,
        context_id: this.state.context_id
      }

      if (this.state.gptModel !== null) {
        requestBody.model = this.state.gptModel;
      }

      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      };
      await fetch(`${this.apiServerUrl}/api/messages`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to send message');
          }
        })
        .catch(error => console.error(error));
      this.setState({ messages: this.messageManager.getMessages(), displayMessages, messageInput: '' });

      const tokenChkBody = {
        messages: this.state.messages,
        model: this.state.gptModel
      }

      const tokenChkReq = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenChkBody)
      };

      await fetch(`${this.apiServerUrl}/api/gettokencount`, tokenChkReq)
        .then(response => response.json())
        .then(data => {
          if (data.tokencounts > 3000) {
            console.log("pruning tokens");
            this.messageManager.checkThresholdAndMove(.25);
            this.setState({ messages: this.messageManager.getMessages(), messagesTokenCount: data.tokencounts });
          }
          console.log(data.tokencounts);
        })
        .catch(error => console.error(error));
    }
  }

  getCallerFunctionName() {
    const stack = new Error().stack;
    const lines = stack.split('\n');
    const callerLine = lines[3];
  
    const match = callerLine.match(/at (?:\w+\.)*(\w+)\s*\(/);
    return match ? match[1] : 'unknown';
  }

  async addMessage(role, message, isFav = false) {
    // const callerFunctionName = this.getCallerFunctionName();
    // console.log('Caller:', callerFunctionName);

    const streambotApi = `${this.apiServerUrl}/api/addmessages`;
    const addMsgRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role, message: message, user_id: this.state.connection_id, context_id: this.state.context_id })
    }
    try {
      await fetch(streambotApi, addMsgRequestOptions);
      this.messageManager.addMessage(role, message, isFav);
      this.setState({ messages: this.messageManager.getMessages() })

      //console.log(this.messageManager.messages);
    } catch (error) {
      console.error('Error in addMessage:', error);
    }
  }

  resetChat(event) {
    event.preventDefault();
    this.showLoading();
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.state.connection_id, context_id: this.state.context_id })
    };
    fetch(`${this.apiServerUrl}/api/newchat`, requestOptions)
      .then(response => {
        if (!response.ok) {
          this.hideLoading();
          throw new Error('Failed to reset chat');
        }
        return fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`);
      })
      .then(response => response.json())
      .then(data => {

        this.setState({ messages: this.messageManager.resetMessages(), displayMessages: [], isUserListingSelectDisabled: false, selectedListingMlsID: '', selectedListingMlsNumber: '' });
        this.getAgentProfile();
        this.listingSelectRef.current.value = '';
        this.areaSelectRef.current.value = '';
        this.hideLoading();
      })
      .catch(error => {
        this.hideLoading();
        console.error(error)
      });
  }

  getUserListings() {
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.state.agentProfileUserId, includeOpenHouses: false }),
    }
    fetch('https://app.thegenie.ai/api/Data/GetAgentProperties', requestOptions)
      .then(response => response.json())
      .then(data => {
        // filter properties with listDate > 60 days ago
        const listings = data.properties.filter(property => {
          const listDate = new Date(property.listDate);
          const daysAgo = (new Date() - listDate) / (1000 * 60 * 60 * 24);
          return daysAgo > 60;
        });

        // sort listings by listDate descending
        listings.sort((a, b) => new Date(b.listDate) - new Date(a.listDate));

        // update state with fetched listings
        this.setState({ listings });
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  generateListingKit() {
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: this.state.agentProfileUserId, collection: 'just-listed-kit', mlsNumber: this.state.selectedListingMlsNumber, mlsID: this.state.selectedListingMlsID, saveDB: true, async: false }),
    }
    fetch('https://hubsandbox.thegenie.ai/wp-json/genie/v1/create-render', requestOptions)
      .then(response => response.json())
      .then(data => {
        const collection = data.result.collection;
        const kitUrl = collection['collection-page'];
        const comment = `Here is your personalized listing-focused kit for ${this.state.selectedListingAddress}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${kitUrl}" target=_blank>Listing Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`
        setTimeout(async () => {
          await this.waitForIncomingChatToFinish();
          const displayMessages = [...this.state.displayMessages];
          displayMessages.push({ role: "assistant", content: comment, isKit: true });
          this.setState({ displayMessages, listingKitUrl: kitUrl });
        }, 30000);

      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  generateAreaKit() {
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: this.state.agentProfileUserId, areaID: this.state.selectedAreaId, collection: 'market-report-kit', saveDB: true, async: false }),
    }
    fetch('https://hubsandbox.thegenie.ai/wp-json/genie/v1/create-render', requestOptions)
      .then(response => response.json())
      .then(data => {
        const collection = data.result.collection;
        const kitUrl = collection['collection-page'];
        const comment = `Here is your personalized area-focused kit for ${this.state.selectedAreaName}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${kitUrl}" target=_blank>Area Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`
        setTimeout(async () => {
          await this.waitForIncomingChatToFinish();
          const displayMessages = [...this.state.displayMessages];
          displayMessages.push({ role: "assistant", content: comment, isKit: true });
          this.setState({ displayMessages, areaKitUrl: kitUrl });
        }, 30000);
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  getUserAreas() {
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.state.agentProfileUserId, includeTerritories: false, consumer: 0 }),
    }
    fetch('https://app.thegenie.ai/api/Data/GetAvailableAreas', requestOptions)
      .then(response => response.json())
      .then(data => {
        const areas = data.areas;
        areas.sort((a, b) => b.hasBeenOptimized - a.hasBeenOptimized);
        // update state with fetched listings
        this.setState({ areas });
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  async getListingAreas() {
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ aspNetUserId: this.state.agentProfileUserId, mlsID: this.state.selectedListingMlsID, mlsNumber: this.state.selectedListingMlsNumber, consumer: 0 }),
    }
    await fetch('https://app.thegenie.ai/api/Data/GetPropertySurroundingAreas', requestOptions)
      .then(response => response.json())
      .then(data => {
        const listingAreas = data.areas;
        listingAreas.sort((a, b) => b.areaApnCount - a.areaApnCount);
        // update state with fetched listing areas
        this.setState({ listingAreas });
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  async userSelectedListing(event) {
    event.preventDefault();
    const [mlsID, mlsNumber] = event.target.value.split('_');
    this.setState({
      selectedListingMlsID: mlsID,
      selectedListingMlsNumber: mlsNumber
    });
    this.showLoading();
    await this.getPropertyProfile(mlsID, mlsNumber, this.state.selectedListingMlsNumber ? true : false);
    this.hideLoading();
    this.generateListingKit();
  }

  async userSelectedArea(event) {
    event.preventDefault();
    const areaId = event.target.value;
    this.showLoading();
    await this.getAreaStatisticsPrompt(areaId, this.state.selectedAreaId ? true : false);
    this.hideLoading();
    this.setState({
      selectedAreaId: areaId
    });
    this.generateAreaKit();
  }

  async userSelectedListingArea(event) {
    event.preventDefault();
    const selectedListingAreaId = event.target.value;
    this.showLoading();
    await this.getAreaStatisticsPrompt(selectedListingAreaId, this.state.selectedListingAreaId ? true : false);
    this.hideLoading();
    this.setState({
      selectedListingAreaId
    });
    this.generateAreaKit();
  }

  async getAreaStatisticsPrompt(areaId, changeArea = false) {
    const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
    const areaStatsptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: areaId, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6, 9, 12] })
    }
    const statsResults = await fetch(areaStatsApi, areaStatsptions);
    const { statistics } = await statsResults.json();

    const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
    const areaNameOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: areaId, userId: this.state.agentProfileUserId, consumer: 0 })
    }
    const nameResults = await fetch(areaNameApi, areaNameOptions);
    const { areaName } = await nameResults.json();

    const areaStatsPrompts = [];

    if (!changeArea) {
      areaStatsPrompts.push(`Information for ${areaName} area:`);
    } else {
      areaStatsPrompts.push(`Please focus on ${areaName} and ignore any previous information provided.`);
    }

    for (const lookback of statistics) {

      areaStatsPrompts.push(`In the past ${lookback.lookbackMonths} months, ${areaName} had ${lookback.overallStatistics.soldPropertyTypeCount} sales, avg. price $${lookback.overallStatistics.averageSalePrice.toLocaleString()}, and avg. ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

      for (const propLookback of lookback.propertyTypeStatistics) {
        const propTypeDescription = propLookback.propertyTypeDescription;
        const statistics = propLookback.statistics;
        areaStatsPrompts.push(`For ${propTypeDescription} homes in the last ${lookback.lookbackMonths} months: avg. sale price $${statistics.averageSalePrice.toLocaleString()}, avg. ${statistics.averageDaysOnMarket} days on market, and avg. $${statistics.averagePricePerSqFt.toLocaleString()} per sq. ft.`);
      }
    }
    const areaStatPrompt = areaStatsPrompts.join('\n');

    if (!changeArea) {
      await this.addMessage("assistant", "Please provide the neighborhood, city, or zip code for the area you need marketing assistance with.");

      await this.addMessage("user", areaStatPrompt);

    } else {
      await this.addMessage("user", areaStatPrompt);

      await this.addMessage("assistant", "I'll use this area's info for future recommendations.");
    }

    this.setState({ selectedAreaId: areaId, selectedAreaName: areaName });
  }

  async getPropertyProfile(mlsId, mlsNumber, changeListing = false) {
    const genieApi = `https://app.thegenie.ai/api/Data/GetUserMlsListing`;
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mlsId: mlsId, mlsNumber: mlsNumber, userId: this.state.agentProfileUserId, consumer: 0 })
    }
    const genieResults = await fetch(genieApi, requestOptions);
    const { listing, ...rest } = await genieResults.json();
    const listingInfo = { ...listing };
    const fullResponse = { listing, ...rest };

    const listingAddress = listingInfo.listingAddress;
    const virtualTourUrl = listingInfo.virtualTourUrl ?? 'Not provided';
    const bedrooms = listingInfo.bedrooms;
    const totalBathrooms = listingInfo.totalBathrooms;
    const propertyType = listingInfo.propertyType;
    const propertyTypeId = listingInfo.propertyTypeID;
    const city = listingInfo.city;
    const state = listingInfo.state;
    const zip = listingInfo.zip;
    const squareFeet = listingInfo.squareFeet ?? 'Not provided';
    const acres = listingInfo.acres ?? 'Not provided';
    const garageSpaces = listingInfo.garageSpaces ?? 'Not provided';
    const yearBuilt = listingInfo.yearBuilt ?? 'Not provided';
    const listingAgentName = listingInfo.listingAgentName;
    const listingBrokerName = listingInfo.listingBrokerName;
    const listingStatus = listingInfo.listingStatus;
    const remarks = listingInfo.remarks;
    const preferredAreaId = fullResponse.preferredAreaId;
    const formatPrice = (price) => {
      return `$${price.toLocaleString()}`;
    };
    const priceStr = listingStatus === "Sold"
      ? `${formatPrice(listingInfo.salePrice)}`
      : (listingInfo.highPrice
        ? `${formatPrice(listingInfo.lowPrice)} - ${formatPrice(listingInfo.highPrice)}`
        : `${formatPrice(listingInfo.lowPrice)}`
      );
    const featuresStr = listingInfo.features.map(feature => `${feature.key}: ${feature.value}`).join(', ');

    if (!changeListing) {
      const assistantPrompt = "Do you have a specific MLS Listing for help today?";

      await this.addMessage("assistant", assistantPrompt);

      const listingPrompt = `New ${listingStatus} property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

      await this.addMessage("user", listingPrompt);
    } else {
      const listingPrompt = `"New ${listingStatus} property for help at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

      await this.addMessage("user", listingPrompt);

      const assistantPrompt = "I'll use this property's info and disregard previous listing info.";

      await this.addMessage("assistant", assistantPrompt);
    }
    await this.getListingAreas();
    if (preferredAreaId > 0) {
      const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
      const areaStatsptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: preferredAreaId, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6, 9, 12] })
      }
      const statsResults = await fetch(areaStatsApi, areaStatsptions);
      const { statistics } = await statsResults.json();

      const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
      const areaNameOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: preferredAreaId, userId: this.state.agentProfileUserId, consumer: 0 })
      }
      const nameResults = await fetch(areaNameApi, areaNameOptions);
      const { areaName } = await nameResults.json();

      const areaStatsPrompts = [];
      areaStatsPrompts.push(`This property exists in the ${areaName} neighborhood.`);

      for (const lookback of statistics) {
        areaStatsPrompts.push(`In the past ${lookback.lookbackMonths} months, ${lookback.overallStatistics.areaName} had ${lookback.overallStatistics.soldPropertyTypeCount} sales, avg. price $${lookback.overallStatistics.averageSalePrice.toLocaleString()}, and avg. ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

        const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

        if (propTypeStats.length > 0) {
          const propTypeDescription = propTypeStats[0].propertyTypeDescription;
          const statistics = propTypeStats[0].statistics;
          areaStatsPrompts.push(`For ${propTypeDescription} homes in the last ${lookback.lookbackMonths} months: avg. sale price $${statistics.averageSalePrice.toLocaleString()}, avg. ${statistics.averageDaysOnMarket} days on market, and avg. $${statistics.averagePricePerSqFt.toLocaleString()} per sq. ft.`);
        }
      }
      const areaStatPrompt = areaStatsPrompts.join('\n');

      await this.addMessage("assistant", "Do you have info about the area or neighborhood of this property?");

      await this.addMessage("user", areaStatPrompt);
      this.setState({ selectedListingAreaId: preferredAreaId });
    }
    else {
      const areaStatsApi = `https://app.thegenie.ai/api/Data/GetZipCodeStatistics`;
      const areaStatsptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: listingInfo.zip, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6, 9, 12] })
      }
      const statsResults = await fetch(areaStatsApi, areaStatsptions);
      const { statistics } = await statsResults.json();

      const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
      const areaNameOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: statistics[0].overallStatistics.id, userId: this.state.agentProfileUserId, consumer: 0 })
      }
      const nameResults = await fetch(areaNameApi, areaNameOptions);
      const { areaName, areaId } = await nameResults.json();

      const areaStatsPrompts = [];
      areaStatsPrompts.push(`This property exists in the ${areaName} zip code.`);

      for (const lookback of statistics) {
        areaStatsPrompts.push(`In the past ${lookback.lookbackMonths} months, ${lookback.overallStatistics.areaName} had ${lookback.overallStatistics.soldPropertyTypeCount} sales, avg. price $${lookback.overallStatistics.averageSalePrice.toLocaleString()}, and avg. ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

        const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

        if (propTypeStats.length > 0) {
          const propTypeDescription = propTypeStats[0].propertyTypeDescription;
          const statistics = propTypeStats[0].statistics;
          areaStatsPrompts.push(`For ${propTypeDescription} homes like this, avg. sale price: $${statistics.averageSalePrice.toLocaleString()}, avg. days on market: ${statistics.averageDaysOnMarket}, avg. price per sq. ft.: $${statistics.averagePricePerSqFt.toLocaleString()}."
            3.) "Property in ${areaName} zip code.`);
        }
      }
      const areaStatPrompt = areaStatsPrompts.join('\n');

      await this.addMessage("assistant", "Do you have info about the area or neighborhood of this property?");

      await this.addMessage("user", areaStatPrompt);
      this.setState({ selectedListingAreaId: areaId });
    }

    this.setState({ selectedListingAddress: listingAddress });
  }

  async getAgentProfile(event) {
    if (event) {
      event.preventDefault();
    }
    const userID = event ? event.target[0].value : this.state.agentProfileUserId;
    this.showLoading();
    const genieApi = `https://app.thegenie.ai/api/Data/GetUserProfile/${userID}`;
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=` }
    }
    const genieResults = await fetch(genieApi, requestOptions);
    const agentInfo = await genieResults.json();
    const name = `${agentInfo.firstName} ${agentInfo.lastName}`;
    const displayName = agentInfo.marketingSettings.profile.displayName ?? name;
    const email = agentInfo.marketingSettings.profile.email ?? agentInfo.emailAddress;
    const phone = agentInfo.marketingSettings.profile.phone ?? agentInfo.phoneNumber;
    const website = agentInfo.marketingSettings.profile.websiteUrl ?? 'Not available';
    const licenseNumber = agentInfo.marketingSettings.profile.licenseNumber ?? 'Not available';
    const about = agentInfo.marketingSettings.profile.about ?? 'Not available';
    const agentProfileImage = agentInfo.marketingSettings.images.find(image => image.marketingImageTypeId === 1)?.url ?? '';

    const assistantPrompt = 'To assist you better, please provide more info about yourself and relevant details for content optimization.';
    await this.addMessage("assistant", assistantPrompt, true);

    const agentPrompt = `Name: ${name}, display name: ${displayName} (use separate lines if different), email: ${email}, phone: ${phone}, website: ${website}, license: ${licenseNumber}, about: ${about}.`;
    await this.addMessage("user", agentPrompt, true);

    this.setState({ isUserIdInputDisabled: true, agentName: name, agentProfileImage: agentProfileImage })
    this.getUserListings();
    this.getUserAreas();
    this.hideLoading();
  }

  render() {
    const {
      context_id,
      displayMessages,
      messageInput,
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
      showCopyNotification
    } = this.state;

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
    ];

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
          this.setState({ messageInput: e.target.value }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;
    
            if (!this.messageExists("user", userMessage)) {
              await this.addMessage("user", userMessage, true);
            }
    
            if (!this.messageExists("assistant", assistantMessage)) {
              await this.addMessage("assistant", assistantMessage, true);
            }
    
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });
    

    const areaButtons = areaMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={isLoading || incomingChatInProgress} value={option.value} onClick={async (e) => {
          this.setState({ messageInput: e.target.value }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;
    
            if (!this.messageExists("user", userMessage)) {
              await this.addMessage("user", userMessage, true);
            }
    
            if (!this.messageExists("assistant", assistantMessage)) {
              await this.addMessage("assistant", assistantMessage, true);
            }
    
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });
    

    const followupButtons = followupMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={isLoading || incomingChatInProgress} value={option.value} onClick={async (e) => {
          this.setState({ messageInput: e.target.value }, async () => {
            const userMessage = option.customPrompt;
            const assistantMessage = `OK, when you say "${option.value}" I will produce my output in this format!`;
    
            if (!this.messageExists("user", userMessage)) {
              await this.addMessage("user", userMessage, true);
            }
    
            if (!this.messageExists("assistant", assistantMessage)) {
              await this.addMessage("assistant", assistantMessage, true);
            }
    
            this.sendMessage(e);
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
          {msg.role === "assistant" && (
            <button className='copy-icon' onClick={() => copyToClipboard(content, index)}>
              {showCopyNotification[index] ? 'Copied!' : 'Copy'}
            </button>
          )}
          {msg.role === "assistant" && msg.id && (
          <span
            className={`heart-icon ${msg.isFav ? "active" : ""}`}
            onClick={() => this.handleToggleFavorite(msg.id)}
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
              <form className='user-form' onSubmit={this.getAgentProfile}>
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
                  <select ref={this.listingSelectRef} className='Content-dropdown' disabled={isUserListingSelectDisabled || incomingChatInProgress} onChange={this.userSelectedListing}>
                    <option value="">-- Select Listing --</option>
                    {listings.map((listing, index) => (
                      <option key={index} value={`${listing.mlsID}_${listing.mlsNumber}`}>
                        {listing.mlsNumber} - {listing.streetNumber} {listing.streetName} {listing.unitNumber} ({listing.statusType})
                      </option>
                    ))}
                  </select>
                  {listingAreas.length > 0 && (
                    <select value={selectedListingAreaId} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={this.userSelectedListingArea}>
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
                  <select ref={this.areaSelectRef} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={this.userSelectedArea}>
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
                  return "Hi, I'm Paisley! Please select a listing from the dropdown to the left";
                } else if (context_id === 1) {
                  return areas.length > 0
                    ? "Hi, I'm Paisley! Please select an area from the dropdown to the left"
                    : "Hi, I'm Paisley! It looks like you haven't saved any areas in TheGenie yet. Please reach out to your Title Partner who shared the link with you to save areas for me to use.";
                } else if (context_id === 2) {
                  return "Hi, I'm Coach Paisley. Feel free to ask about anything real estate related!";
                } else if (context_id === 3) {
                  return "Hi, I'm The Ultimate Real Estate Follow Up Helper. I'm here to help you gameplan your marketing efforts and stay organized!";
                }
              } else {
                return messages;
              }
            })()}
          </div>
          <div id="chat-input">
            <select
              className='Context-dropdown'
              onChange={this.changeContext}
              value={context_id}
              disabled={isLoading || incomingChatInProgress}
            >
              {contextItems}
            </select>
            <form onSubmit={this.sendMessage}>
              <textarea
                value={messageInput}
                ref={this.textareaRef}
                className="chat-input-textarea"
                onChange={(e) => this.setState({ messageInput: e.target.value })}
                onInput={this.autoGrowTextarea}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage(e);
                  }
                }}
                placeholder="Enter your message..."
                disabled={isLoading || incomingChatInProgress}
              />

              <div className='button-group'>
                <button
                  disabled={isLoading || incomingChatInProgress}
                  type="submit">Send</button>
                <button
                  disabled={isLoading || incomingChatInProgress}
                  onClick={this.resetChat}>Reset Chat</button>
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

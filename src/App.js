import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';
import { LISTINGMENUITEMS as listingMenuItems, AREAMENUITEMS as areaMenuItems, FOLLOWUPMENUITEMS as followupMenuItems} from './constants'

class App extends Component {
  constructor(props) {
    super(props);
    const searchParams = new URLSearchParams(window.location.search);
    this.state = {
      messages: [],
      displayMessages: [],
      messageInput: '',
      connection_id: '',
      context_id: 0,
      agentProfileUserId: searchParams.get('agentProfileUserId') || '',
      isUserIdInputDisabled: searchParams.get('agentProfileUserId') ? true : false,
      isUserListingSelectDisabled: false,
      isUserAreaSelectDisabled: false,
      isLoading: false,
      showCopyNotification: false,
      selectedListingMlsID: '',
      selectedListingMlsNumber: '',
      agentName: '',
      agentProfileImage: '',
      listings: [],
      areas: [],
      listingKitUrl: '',
      areaKitUrl: '',
      selectedAreaName: '',
      selectedListingAddress: '',
      incomingChatInProgress: false,
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.getAgentProfile = this.getAgentProfile.bind(this);
    this.getPropertyProfile = this.getPropertyProfile.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.userSelectedListing = this.userSelectedListing.bind(this);
    this.userSelectedArea = this.userSelectedArea.bind(this);
    this.generateListingKit = this.generateListingKit.bind(this);
    this.generateAreaKit = this.generateAreaKit.bind(this);
    this.waitForIncomingChatToFinish = this.waitForIncomingChatToFinish.bind(this);
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
    this.textareaRef = React.createRef();
    this.apiServerUrl = 'https://paisley-api-naqoz.ondigitalocean.app'
    //this.apiServerUrl = 'http://127.0.0.1:8008'
  }

  componentDidMount() {
    this.socket = io(this.apiServerUrl, {
      pingInterval: 25000, //25 seconds
      pingTimeout: 60000 //60 seconds
    });
    this.socket.on('message', this.handleMessage);
    this.socket.on('emit_event', (data) => {
      // call the callback function with the data provided by the server
      this.socket.emit('callback_event', data.callback_data);
      this.setState({incomingChatInProgress: true});
    });
    this.socket.on('message_complete', () => {
      this.setState({incomingChatInProgress: false});
      this.textareaRef.current.focus();
    });
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id }, () => {
        fetch(`${this.apiServerUrl}/api/getmessages/${this.state.context_id}/${this.state.connection_id}`)
          .then(response => response.json())
          .then(data => {
            const messages = data.map(msg => ({ role: msg.role, content: msg.content }));
            this.setState({ messages: messages });
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

  // function to show loading indicator/notification
  showLoading() {
    this.setState({ isLoading: true });
  }

  // function to hide loading indicator/notification
  hideLoading() {
    this.setState({ isLoading: false });
  }

  changeContext(event) {
    const newContextId = parseInt(event.target.value);
    this.setState({ context_id: newContextId, messages: [], displayMessages: [] });
    fetch(`${this.apiServerUrl}/api/getmessages/${newContextId}/${this.state.connection_id}`)
      .then(response => response.json())
      .then(data => {
        const messages = data.map(msg => ({ role: msg.role, content: msg.content }));
        this.setState({ messages: messages });
        if (newContextId === 2 || newContextId === 3) {
          this.getAgentProfile();
        }
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
        this.setState({ messages, displayMessages, messageInput: '' });
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
        const messages = data.map(msg => ({ role: msg.role, content: msg.content }));
        this.setState({ messages: messages, displayMessages: [], isUserListingSelectDisabled: false, selectedListingMlsID: '', selectedListingMlsNumber: '' });
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


  scrollToBottom() {
    if (this.chatDisplayRef.current) {
      this.chatDisplayRef.current.scrollTop = this.chatDisplayRef.current.scrollHeight;
    }
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

  async waitForIncomingChatToFinish() {
    while (this.state.incomingChatInProgress) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
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
          displayMessages.push({role: "assistant", content: comment});
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
      body: JSON.stringify({ api_id: this.state.agentProfileUserId, areaID: this.state.selectedAreaId, collection: 'market-report-kit',  saveDB: true, async: false }),
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
          displayMessages.push({role: "assistant", content: comment});
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

  async userSelectedListing(event) {
    event.preventDefault();
    const [mlsID, mlsNumber] = event.target.value.split('_');
    this.showLoading();
    await this.getPropertyProfile(mlsID, mlsNumber);
    this.hideLoading();
    this.setState({
      selectedListingMlsID: mlsID,
      selectedListingMlsNumber: mlsNumber
    });
    this.generateListingKit();
  }

  async userSelectedArea(event) {
    event.preventDefault();
    const areaId = event.target.value;
    this.showLoading();
    await this.getAreaStatisticsPrompt(areaId);
    this.hideLoading();
    this.setState({
      selectedAreaId: areaId
    });
    this.generateAreaKit();
  }

  async getAreaStatisticsPrompt(areaId) {
    const messages = this.state.messages.slice();
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
    areaStatsPrompts.push(`The following information is for ${areaName}.`);
    
    for (const lookback of statistics) {
      
      areaStatsPrompts.push(`Over the last ${lookback.lookbackMonths} months, ${areaName} saw ${lookback.overallStatistics.soldPropertyTypeCount} sales with an average sales price of $${lookback.overallStatistics.averageSalePrice.toLocaleString()} and an average of ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

      for (const propLookback of lookback.propertyTypeStatistics) {
        const propTypeDescription = propLookback.propertyTypeDescription;
        const statistics = propLookback.statistics;
        areaStatsPrompts.push(`For the ${propTypeDescription} type homes, the market saw an average sale price of $${statistics.averageSalePrice.toLocaleString()} in the last ${lookback.lookbackMonths} with an average days on market of ${statistics.averageDaysOnMarket}. The average listing price per square foot was $${statistics.averagePricePerSqFt.toLocaleString()}.`);
      }
    }
    const areaStatPrompt = areaStatsPrompts.join('\n');

    await this.addMessage("assistant", "Great! Can you provide me with information about the neighborhood, city or zip code you would like assistance with marketing to?");
    messages.push({ role: "assistant", content: "Great! Can you provide me with information about the neighborhood, city or zip code you would like assistance with marketing to?" });

    await this.addMessage("user", areaStatPrompt);
    messages.push({ role: "user", content: areaStatPrompt });
    this.setState({ messages, selectedAreaName: areaName });
  }

  async getPropertyProfile(mlsId, mlsNumber) {
    const messages = this.state.messages.slice();
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
    const virtualTourUrl = listingInfo.virtualTourUrl;
    const bedrooms = listingInfo.bedrooms;
    const totalBathrooms = listingInfo.totalBathrooms;
    const propertyType = listingInfo.propertyType;
    const propertyTypeId = listingInfo.propertyTypeID;
    const city = listingInfo.city;
    const state = listingInfo.state;
    const zip = listingInfo.zip;
    const squareFeet = listingInfo.squareFeet;
    const acres = listingInfo.acres;
    const garageSpaces = listingInfo.garageSpaces;
    const yearBuilt = listingInfo.yearBuilt;
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

    const assistantPrompt = 'Do you have a specific MLS Listing that you\'d like help with today?';

    await this.addMessage("assistant", assistantPrompt);
    messages.push({ role: "assistant", content: assistantPrompt });

    const listingPrompt = `I have a new ${listingStatus} property located at: ${listingAddress} ${listingStatus === 'Active' ? 'Listed' : (listingStatus === 'Pending' ? 'Pending' : 'Sold')}
    for ${priceStr}!\nMLS Number: ${mlsNumber}\nVirtual Tour: ${virtualTourUrl}\nBedrooms: ${bedrooms}\nBathrooms: ${totalBathrooms}\nProperty Type: ${propertyType}\nCity: ${city}\nState: ${state}\nZip:${zip}\nSquare Feet: ${squareFeet}\nAcres: ${acres}\nGarage Spaces: ${garageSpaces}\nYear Built: ${yearBuilt}\nListing Agent: ${listingAgentName} (${listingBrokerName})\nListing Status: ${listingStatus}\nProperty Features: ${featuresStr}\nAdditional Property Details: ${remarks}. Please keep in mind that the "Additional Property Details" do not change as the listing status changes, so do not use any listing status information from that field.`;

    await this.addMessage("user", listingPrompt);
    messages.push({ role: "user", content: listingPrompt });

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
        areaStatsPrompts.push(`Over the last ${lookback.lookbackMonths} months, ${lookback.overallStatistics.areaName} saw ${lookback.overallStatistics.soldPropertyTypeCount} sales with an average sales price of $${lookback.overallStatistics.averageSalePrice.toLocaleString()} and an average of ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

        const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

        if (propTypeStats.length > 0) {
          const propTypeDescription = propTypeStats[0].propertyTypeDescription;
          const statistics = propTypeStats[0].statistics;
          areaStatsPrompts.push(`For the ${propTypeDescription} type homes like the subject property, the market saw an average sale price of $${statistics.averageSalePrice.toLocaleString()} with an average days on market of ${statistics.averageDaysOnMarket}. The average listing price per square foot was $${statistics.averagePricePerSqFt.toLocaleString()}.`);
        }
      }
      const areaStatPrompt = areaStatsPrompts.join('\n');

      await this.addMessage("assistant", "Great! Do you have any information about the area or neighborhood this property is located in?");
      messages.push({ role: "assistant", content: "Great! Do you have any information about the area or neighborhood this property is located in?" });

      await this.addMessage("user", areaStatPrompt);
      messages.push({ role: "user", content: areaStatPrompt });
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
      const { areaName } = await nameResults.json();

      const areaStatsPrompts = [];
      areaStatsPrompts.push(`This property exists in the ${areaName} zip code.`);

      for (const lookback of statistics) {
        areaStatsPrompts.push(`Over the last ${lookback.lookbackMonths} months, ${lookback.overallStatistics.areaName} saw ${lookback.overallStatistics.soldPropertyTypeCount} sales with an average sales price of $${lookback.overallStatistics.averageSalePrice.toLocaleString()} and an average of ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

        const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

        if (propTypeStats.length > 0) {
          const propTypeDescription = propTypeStats[0].propertyTypeDescription;
          const statistics = propTypeStats[0].statistics;
          areaStatsPrompts.push(`For the ${propTypeDescription} type homes like the subject property, the market saw an average sale price of $${statistics.averageSalePrice.toLocaleString()} with an average days on market of ${statistics.averageDaysOnMarket}. The average listing price per square foot was $${statistics.averagePricePerSqFt.toLocaleString()}.`);
        }
      }
      const areaStatPrompt = areaStatsPrompts.join('\n');

      await this.addMessage("assistant", "Great! Do you have any information about the area or neighborhood this property is located in?");
      messages.push({ role: "assistant", content: "Great! Do you have any information about the area or neighborhood this property is located in?" });

      await this.addMessage("user", areaStatPrompt);
      messages.push({ role: "user", content: areaStatPrompt });
    }

    this.setState({ messages: messages, selectedListingAddress: listingAddress });
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
    const displayName = agentInfo.marketingSettings.profile.displayName;
    const email = agentInfo.marketingSettings.profile.email;
    const phone = agentInfo.marketingSettings.profile.phone;
    const website = agentInfo.marketingSettings.profile.websiteUrl;
    const licenseNumber = agentInfo.marketingSettings.profile.licenseNumber;
    const about = agentInfo.marketingSettings.profile.about;
    const agentProfileImage = agentInfo.marketingSettings.images.find(image => image.marketingImageTypeId === 1)?.url ?? '';
    const messages = this.state.messages.slice();

    const assistantPrompt = 'In order you assist you in the best possible way, can you provide me with more information about yourself and any relevant details I might need to optimize my content suggestions?';

    await this.addMessage("assistant", assistantPrompt);

    messages.push({ role: "assistant", content: assistantPrompt });

    const agentPrompt = `Sure! My name is ${name}, my prefered display name for marketing purposes is ${displayName} so when constructing signature blocks, list my name and my display name as separate lines if they are different, my email address is ${email}, my phone number is ${phone}, my website is ${website}, my license number is ${licenseNumber}. A little about myself: ${about}`;

    await this.addMessage("user", agentPrompt);

    messages.push({ role: "user", content: agentPrompt });
    this.setState({ messages: messages, isUserIdInputDisabled: true, agentName: name, agentProfileImage: agentProfileImage })
    this.getUserListings();
    this.getUserAreas();
    this.hideLoading();
  }

  async addMessage(role, message) {
    const streambotApi = `${this.apiServerUrl}/api/addmessages`;
    const addMsgRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role, message: message, user_id: this.state.connection_id, context_id: this.state.context_id })
    }
    try {
      await fetch(streambotApi, addMsgRequestOptions);
    } catch (error) {
      console.error('Error in addMessage:', error);
    }
    
  }

  autoGrowTextarea = () => {
    const textarea = this.textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  render() {
    const { isUserIdInputDisabled } = this.state;
    const contextOptions = [
      { value: 0, label: 'Listing Marketing' },
      { value: 1, label: 'Area Marketing' },
      { value: 2, label: 'RE Coaching' },
      { value: 3, label: 'Follow Up' },
    ];

    const dropdownItems = contextOptions.map((option, index) => {
      return (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      );
    });

    

    const listingButtons = listingMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={this.state.isLoading || this.state.incomingChatInProgress} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, async () => {
            await this.addMessage("user", option.customPrompt)
            await this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const areaButtons = areaMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={this.state.isLoading || this.state.incomingChatInProgress} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, async () => {
            await this.addMessage("user", option.customPrompt)
            await this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const followupButtons = followupMenuItems.map((option, index) => {
      return (
        <button key={index} disabled={this.state.isLoading || this.state.incomingChatInProgress} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, async () => {
            await this.addMessage("user", option.customPrompt)
            await this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const copyToClipboard = (text) => {
      const turndownService = new TurndownService();
      const markdown = turndownService.turndown(text);
      navigator.clipboard.writeText(markdown);

      // add animation to copy button
      const copyButton = document.querySelector('.copy-icon');
      this.setState({ showCopyNotification: true });
      copyButton.classList.add('copied');
      setTimeout(() => {
        copyButton.classList.remove('copied');
        this.setState({ showCopyNotification: false });
      }, 2500);
    };


    const messages = this.state.displayMessages.map((msg, index) => {
      const content = parse(msg.content, { renderer: new Renderer() });
      return (
        <div
          key={index}
          className={`chat-bubble ${msg.role === "user" ? "user" : "assistant"}`}
        >
          <div className="sender">{msg.role === "user" ? "Me:" : "Paisley:"}</div>
          <div className="message" dangerouslySetInnerHTML={{ __html: content }}></div>
          {msg.role === "assistant" && (
            <button className='copy-icon' onClick={() => copyToClipboard(content)}>
              {this.state.showCopyNotification ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      );
    });

    return (
      <div className="App">
        <div id="loading-container" style={{ display: this.state.isLoading ? 'flex' : 'none' }}>
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
                    value={this.state.agentProfileUserId}
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
                  {this.state.agentProfileImage !== '' && (
                    <img className='agent-profile-image' alt={`Headshot of ${this.state.agentName}`} src={this.state.agentProfileImage} />
                  )}
                  {this.state.agentName !== '' && (
                    <h2 className='sidebar-subtitle'>
                      {this.state.agentName}
                    </h2>
                  )}
                </div>
              </form>
              {this.state.context_id === 0 && this.state.agentProfileUserId && this.state.listings.length > 0 && (
                <div className='sidebar-section listingSelectBox'>
                  <select ref={this.listingSelectRef} className='Content-dropdown' disabled={this.state.isUserListingSelectDisabled || this.state.incomingChatInProgress} onChange={this.userSelectedListing}>
                    <option value="">-- Select Listing --</option>
                    {this.state.listings.map((listing, index) => (
                      <option key={index} value={`${listing.mlsID}_${listing.mlsNumber}`}>
                        {listing.mlsNumber} - {listing.streetNumber} {listing.streetName} {listing.unitNumber} ({listing.statusType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {this.state.context_id === 1 && this.state.agentProfileUserId && this.state.areas.length > 0 && (
                <div className='sidebar-section areaSelectBox'>
                  <select ref={this.areaSelectRef} className='Content-dropdown' disabled={this.state.isUserAreaSelectDisabled || this.state.incomingChatInProgress} onChange={this.userSelectedArea}>
                    <option value="">-- Select Area --</option>
                    {this.state.areas.map((area, index) => (
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
              {this.state.context_id === 0 ? listingButtons : (this.state.context_id === 1 ? areaButtons : (this.state.context_id === 3 ? followupButtons : 'No quick actions available for this context'))}
            </div>
          </div>
        </div>
        <div className='main-content'>

          <div id="chat-display" ref={this.chatDisplayRef}>
            {messages.length === 0 && this.state.context_id === 0 ? "Hi, I'm Paisley! Please select a listing from the dropdown to the left" :
              (messages.length === 0 && this.state.context_id === 1 ? "Hi, I'm Paisley! Please select an area from the dropdown to the left" :
                (messages.length === 0 && this.state.context_id === 2 ? "Hi, I'm Coach Paisley. Feel free to ask about anything real estate related!" :
                  (messages.length === 0 && this.state.context_id === 3 ? "Hi, I'm The Ultimate Real Estate Follow Up Helper. I'm here to help you gameplan your marketing efforts and stay organized!" : messages)))}
          </div>
          <div id="chat-input">
            <select 
              className='Context-dropdown' 
              onChange={this.changeContext} 
              value={this.state.context_id}
              disabled={this.state.isLoading || this.state.incomingChatInProgress}
            >
              {dropdownItems}
            </select>
            <form onSubmit={this.sendMessage}>
              <textarea
                value={this.state.messageInput}
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
                disabled={this.state.isLoading || this.state.incomingChatInProgress}
              />

              <div className='button-group'>
                <button 
                disabled={this.state.isLoading || this.state.incomingChatInProgress}
                type="submit">Send</button>
                <button 
                disabled={this.state.isLoading || this.state.incomingChatInProgress}
                onClick={this.resetChat}>Reset Chat</button>
              </div>
            </form>
          </div>
          <div id="footer">
            <span>Copyright © 2023 1parkplace, Inc. All rights reserved. - TheGenie.ai - US Patent #: 10,713,325</span>
          </div>
        </div>
      </div>
    );
  }
}

export default App;

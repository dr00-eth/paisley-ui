import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';

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
      listings: [],
      areas: []
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.getAgentProfile = this.getAgentProfile.bind(this);
    this.getPropertyProfile = this.getPropertyProfile.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.userSelectedListing = this.userSelectedListing.bind(this);
    this.userSelectedArea = this.userSelectedArea.bind(this);
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
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
    console.log("handleMessage hit");
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
    console.log("sendMessage hit");
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
    console.log(this.state.messages);
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
    console.log(`${mlsID}_${mlsNumber}`);
    this.showLoading();
    await this.getPropertyProfile(mlsID, mlsNumber);
    this.hideLoading();
    this.setState({
      selectedListingMlsID: mlsID,
      selectedListingMlsNumber: mlsNumber
    });
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
    console.log(this.state.messages);
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
    this.setState({ messages });
    console.log(messages);
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

    console.log(messages);
    this.setState({ messages: messages, isUserListingSelectDisabled: true });
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
    const messages = this.state.messages.slice();

    const assistantPrompt = 'In order you assist you in the best possible way, can you provide me with more information about yourself and any relevant details I might need to optimize my content suggestions?';

    await this.addMessage("assistant", assistantPrompt);

    messages.push({ role: "assistant", content: assistantPrompt });

    const agentPrompt = `Sure! My name is ${name}, my prefered display name for marketing purposes is ${displayName} so when constructing signature blocks, list my name and my display name as separate lines if they are different, my email address is ${email}, my phone number is ${phone}, my website is ${website}, my license number is ${licenseNumber}. A little about myself: ${about}`;

    await this.addMessage("user", agentPrompt);

    messages.push({ role: "user", content: agentPrompt });
    console.log(messages);
    this.setState({ messages: messages, isUserIdInputDisabled: true })
    this.getUserListings();
    this.getUserAreas();
    this.hideLoading();
    console.log(this.state.messages);
  }

  async addMessage(role, message) {
    const streambotApi = `${this.apiServerUrl}/api/addmessages`;
    const addMsgRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role, message: message, user_id: this.state.connection_id, context_id: this.state.context_id })
    }
    await fetch(streambotApi, addMsgRequestOptions);
  }

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

    const listingMenuItems = [
      { value: "Generate Action Plan", label: 'Action Plan', customPrompt: 'You are going to display an action plan for REALTOR clients designed into the first page of a webapp called TheGenie.  You will take things step-by-step. Always write in 2nd person. Do not provide an introduction sentence. Instead, go straight into the plan. The action plan will have 4 sections. The first section is called The Breakdown and it will breakdown the current listing selected. The breakdown will have stats on the listing, any key features to highlight during marketing, information on the zip code, and any other pertinent details about the listing that the user should know for marketing. The next section is called The Gameplan. The Gameplan will use information from the breakdown to come up with a 3 Channel marketing approach. In The Gameplan, you will layout the channel for marketing, the potential targets, potential deliverables, and a brief description of what the campaign would look like, as well as any pros and cons to it. Be unique and create campaigns tailored to the location of the listing. The final section will be The Recap, and it will provide step by step instructions on how to implement each channel. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Remember, take things step-by-step. After you are done, ask the user if they would like to go into more detail about any specific campaign and continue the conversation from there.' },
      { value: "Write A Blog Post", label: 'Blog Post', customPrompt: 'You will create a custom blog post about the listing and include information about the zip code the listing is in based on the information given to you. Do not provide an introduction sentence. Instead, go straight into the blog. Be comprehensive and light hearted in tone. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take things step-by-step. After you are done, ask the user if they would like to change the tone, content, or anything else about the blog and follow their direction.' },
      { value: "Compose An Email", label: 'Email', customPrompt: 'Write an email about the listing and be sure to include any key features and information about the zip code it is located in. Do not provide an introduction sentence. Instead, go straight into the email. Make sure the email is friendly, informative, and unique. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take things step-by-step. After you are done, ask the user if they would like to change the tone, content, or anything else about the email and follow their direction.' },
      { value: "Generate Facebook Ad Content", label: 'Facebook Ad Content', customPrompt: 'You will create Facebook ad content to market a specific listing. Your goal is to attract potential home buyers to the listing by highlighting its key features and benefits. Use the information provided to you about the listing to create an ad that is engaging and informative. Display in markdown format with the campaign idea being h1, and the actual adcopy of the facebook ad being regular text. Take things step-by-step. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to make any changes or additions to the Facebook ad content.' },
      { value: "Create Buyer Focused Marketing", label: 'Buyer Marketing', customPrompt: 'Create an campaign plan to target buyers for the chosen property. Do not provide an introduction sentence. Instead, go straight into the campaign. Choose one type of campaign and layout the channel, potential targets, deliverables, scale from 1-10 of how hard it would be to implement, pros and cons to the campaign, and any other information relevant for choosing the perfect marketing campaign. Do not choose more than one campaign. Remember the focus is on buyers so we want to highlight the properties features and try and target neighborhoods that make sense for people to move from. Do not make up any information, only use hard data where it was given to you. If the property chosen was already sold status, the campaign should focus on the fact that I (the REALTOR) have many more buyers ready to move into their next dream home. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take it step-by-step. After you are done, ask the user if they like this campaign or want to randomly generate another idea. If they respond that they like the campaign, go into more details and create the actual content and step by step gameplan they can enact. If they request a new randomly generated campaign, choose one just like before.' },
      { value: "Create a Video Tour Script", label: 'Video Tour Script', customPrompt: 'You will create a script for a video tour of the selected listing. Use the information provided to you to create a script tailored to the specific property. Make sure to highlight all the key features of the property and provide a comprehensive tour. Use engaging language and tone, and make sure the script is visually appealing. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take things step-by-step. After you are done, ask the user if they would like to make any changes or additions to the video tour script.' },
      { value: "Create an Instagram Reel", label: 'Reel Script', customPrompt: 'You will create an Instagram Reel for the selected listing. Use the information provided to you to create a Reel tailored to the specific property. Make sure to highlight all the key features of the property and provide a comprehensive tour. Use engaging language and tone, and make sure the Reel is visually appealing. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take things step-by-step. After you are done, ask the user if they would like to make any changes or additions to the Instagram Reel.' },
      { value: "Create SMS Message Content", label: 'Text Message', customPrompt: 'You will create 5 SMS messages to send to potential clients about a specific property or neighborhood. The message should be brief, informative, and unique. Include key features of the property or neighborhood, a call to action to reach out to the user, and any other relevant information. Each message will have 2 parts. Part 1 is the title of the campaign which will give a general idea of what the concept of the text message is. Part 2 will be the actual message in its entirety. Do not include any of the actual text message in Part 1. Display in markdown format with Part 1 being h1, and part 2 being regular text. Only use data that has been given to you. Do not make up any open house times, area information, or listing information. Keep it 160 characters or under. Take things step-by-step. After you are done, ask the user if they would like to make any changes or additions to the SMS message and follow their direction.' },

    ];

    const listingButtons = listingMenuItems.map((option, index) => {
      return (
        <button key={index} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, () => {
            this.addMessage("user", option.customPrompt)
            this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const areaMenuItems = [
      { value: "Generate Action Plan", label: 'Generate Action Plan', customPrompt: 'You are going to display an action plan for REALTOR clients designed into the first page of a webapp called TheGenie.  You will take things step-by-step. Always write in 2nd person. Do not provide an introduction sentence. Instead, go straight into the plan. The action plan will have 4 sections. The first section is called The Breakdown and it will breakdown the current area selected. The breakdown will have stats on the area, any key features to highlight during marketing, information on the local points of interest, and any other pertinent details about the listing that the user should know for marketing. The next section is called The Gameplan. The Gameplan will use information from the breakdown to come up with a 3 Channel marketing approach. In The Gameplan, you will layout the channel for marketing, the potential targets, potential deliverables, and a brief description of what the campaign would look like, as well as any pros and cons to it. Be unique and create campaigns tailored to the location of the listing. The final section will be The Recap, and it will provide step by step instructions on how to implement each channel. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Remember, take things step-by-step. After you are done, ask the user if they would like to go into more detail about any specific campaign and continue the conversation from there.' },
      { value: "Create Facebook Ad Content", label: 'Create Facebook Ad Content', customPrompt: 'You will create Facebook ad content to market a specific area. Your goal is to attract potential home buyers to the area by highlighting its key features and benefits. Use the information provided to you about the area, such as its demographics, amenities, and attractions, to create an ad that is engaging and informative. Make sure to also mention any notable real estate properties in the area that are currently available for sale. Display in markdown format with the campaign idea being h1, and the actual adcopy of the facebook ad being regular text. Take things step-by-step. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to make any changes or additions to the Facebook ad content.' },
      { value: "Create an Instagram Reel for the Area", label: 'Create an Instagram Reel', customPrompt: 'You will create an Instagram Reel to market the selected area. Use the information provided to you to create a Reel tailored to the specific location. Make sure to highlight all the key features of the area, including local attractions, dining options, outdoor activities, and anything else that would make someone want to visit or live in the area. Use engaging language and tone, and make sure the Reel is visually appealing. Incorporate relevant hashtags and a call to action to encourage viewers to learn more about the area or contact the REALTOR for more information. Display in markdown format with each section being h1, and create sections with instructions for each part of the content, script, layout of the video, etc that they would need to do to create the reel. Take things step-by-step. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to make any changes or additions to the Instagram Reel.' },
      { value: "Create an Area Marketing Plan", label: 'Create an Area Marketing Plan', customPrompt: 'You are going to create a marketing plan for a specific area that highlights the unique features and benefits of living there. You will ask the user any questions you need answers to in order to create a quality, easy to follow and implement effective marketing plan. After each question is answered by the user, continue to ask questions until you have everything you need. You will be given data about the area beforehand. Display your plan in markdown format with each section as an H1 heading, and each numbered point within each section as a bullet point. Remember to take things step-by-step and use engaging language and tone. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to go into more detail about any specific campaign and continue the conversation from there.' },
      { value: "Write an Area Blog Post", label: 'Write an Area Blog Post', customPrompt: 'You will create a custom blog post about a specific area and include information about the local real estate market and demographics. Do not provide an introduction sentence. Instead, go straight into the blog. Be comprehensive and light-hearted in tone, highlighting the unique features and benefits of living in the area. Display your post in markdown format with each section as an H1 heading, with bullet points, numbered lists, or regular text underneath. Feel free to add h2 tags if it makes sense. Take things step-by-step and use engaging language and tone. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to change the tone, content, or anything else about the blog and follow their direction.' },
      { value: "Compose an Area Guide", label: 'Compose an Area Guide', customPrompt: 'Use the information provided to you about a specific area to create a comprehensive guide for people looking to move there. Do not provide an introduction sentence. Instead, go straight into the guide. Be comprehensive with different sections laid out such as hot spots, key data points, things to do, and anything else that would be good in a guide for people looking to move to the area. Also add in points of interest for the area. Make sure to incorporate a call to action to reach out to the user about their new property. Display your guide in markdown format with each section as an H1 heading, and information under them as numbered lists or bullet points. H2 tags can be used where applicable. Take things step-by-step and use engaging language and tone. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to change the tone, content, or anything else about the area guide and follow their direction.' },
      { value: "Compose an Area Email", label: 'Compose an Area Email', customPrompt: 'Write an email about a specific area and be sure to include any key features, statistics, and information about the local real estate market. Do not provide an introduction sentence. Instead, go straight into the email. Make sure the email is friendly, informative, and unique. Display your email in the format of an email with a signature section based on the user information given to you. Take things step-by-step and use engaging language and tone. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to change the tone, content, or anything else about the email and follow their direction.' },
      { value: "Create a Newsletter", label: 'Create a Newsletter', customPrompt: 'You will create a newsletter about a specific neighborhood to send out to potential clients. The newsletter should include information about the area such as key data points, hot spots, things to do, and anything else that would be good for someone who is considering moving to the area to know. Be comprehensive and light-hearted in tone. Use engaging language and tone in the newsletter. Display in markdown format with each section being h1, each numbered point within each section and bullet points under each number. Take things step-by-step. Only use data that has been given to you. Do not make up any open house times, area information, or listing information.  After you are done, ask the user if they would like to change the tone, content, or anything else about the newsletter and follow their direction.' },
      { value: "Create SMS Message Content", label: 'Create SMS Message Content', customPrompt: 'You will create 5 SMS messages to send to potential clients about a specific property or neighborhood. The message should be brief, informative, and unique. Include key features of the property or neighborhood, a call to action to reach out to the user, and any other relevant information. Each message will have 2 parts. Part 1 is the title of the campaign which will give a general idea of what the concept of the text message is. Part 2 will be the actual message in its entirety. Do not include any of the actual text message in Part 1. Display in markdown format with Part 1 being h1, and part 2 being regular text. Only use data that has been given to you. Do not make up any open house times, area information, or listing information. Keep it 160 characters or under. Take things step-by-step. After you are done, ask the user if they would like to make any changes or additions to the SMS message and follow their direction.' },
    ];

    const areaButtons = areaMenuItems.map((option, index) => {
      return (
        <button key={index} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, () => {
            this.addMessage("user", option.customPrompt)
            this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
            this.sendMessage(e);
          });
        }}>
          {option.label}
        </button>
      );
    });

    const followupMenuItems = [
      { value: "Quick Gameplan", label: 'Quick Gameplan', customPrompt: 'You are going to create a quick follow up gameplan. This will be a follow up plan that is specific to a particular lead. Please ask any pertinent questions about the lead information, how they became leads, what step of the process they are in, any deliverables they have received, and anything else the best follow up real estate agent assistant would ask. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
      { value: "1 Month Plan", label: '1 Month Plan', customPrompt: 'You are going to create a 1 month follow up gameplan. Please ask any pertinent questions about the lead information, how they became leads, what step of the process they are in, any deliverables they have received, and anything else the best follow up real estate agent assistant would ask. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
      { value: "3 Month Plan", label: '3 Month Plan', customPrompt: 'You are going to create a 3 month follow up gameplan. Please ask any pertinent questions about the lead information, how they became leads, what step of the process they are in, any deliverables they have received, and anything else the best follow up real estate agent assistant would ask. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
      { value: "6 Month Plan", label: '6 Month Plan', customPrompt: 'You are going to create a 6 month follow up gameplan. Please ask any pertinent questions about the lead information, how they became leads, what step of the process they are in, any deliverables they have received, and anything else the best follow up real estate agent assistant would ask. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
      { value: "9 Month Plan", label: '9 Month Plan', customPrompt: 'You are going to create a 9 month follow up gameplan. Please ask any pertinent questions about the lead information, how they became leads, what step of the process they are in, any deliverables they have received, and anything else the best follow up real estate agent assistant would ask. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
      { value: "Long Term Plan", label: 'Long Term Plan', customPrompt: 'You are going to create a long term follow up gameplan. Ask questions like what type of channels are preferable, and how many times they want to target each lead they have. Ask anything relevant to long term follow up planning. Once you have the information you need, please create the outline for the plan. Be comprehensive and use markdown format to organize. Afterwards, ask which section to break down even further and always be comprehensive and detailed in all of your responses. Make sure to use information you received from prior questioning and the information given to you.' },
    ];

    const followupButtons = followupMenuItems.map((option, index) => {
      return (
        <button key={index} value={option.value} onClick={(e) => {
          this.setState({ messageInput: e.target.value }, () => {
            this.addMessage("user", option.customPrompt)
            this.addMessage("assistant", `OK, when you say "${option.value}" I will produce my output in this format!`)
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
        <header className="App-header">
          <h1 className="App-title">TheGenie - Paisley</h1>
          <form className='user-form' onSubmit={this.getAgentProfile}>
            <input
              type="text"
              value={this.state.agentProfileUserId}
              placeholder="Enter AspNetUserID"
              onChange={(e) => this.setState({ agentProfileUserId: e.target.value })}
              disabled={isUserIdInputDisabled}
            />
            {isUserIdInputDisabled === false && (
              <button
                disabled={isUserIdInputDisabled}
                type="submit">Save</button>
            )}
          </form>
          {this.state.context_id === 0 && this.state.agentProfileUserId && this.state.listings.length > 0 && (
            <div className='listingSelectBox'>
              <label>Select Listing </label>
              <select ref={this.listingSelectRef} className='Content-dropdown' disabled={this.state.isUserListingSelectDisabled} onChange={this.userSelectedListing}>
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
            <div className='areaSelectBox'>
              <label>Select Area </label>
              <select ref={this.areaSelectRef} className='Content-dropdown' disabled={this.state.isUserAreaSelectDisabled} onChange={this.userSelectedArea}>
                <option value="">-- Select Area --</option>
                {this.state.areas.map((area, index) => (
                  <option key={index} value={area.areaId}>
                    {area.areaName} ({area.areaType}) {area.hasBeenOptimized ? '*' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>
        <div id="chat-display" ref={this.chatDisplayRef}>
          {messages.length === 0 && this.state.context_id === 0 ? "Hi, I'm Paisley! Please select a listing from the dropdown above" :
            (messages.length === 0 && this.state.context_id === 1 ? "Hi, I'm Paisley! Please select an area from the dropdown above" :
              (messages.length === 0 && this.state.context_id === 2 ? "Hi, I'm Coach Paisley. Feel free to ask about anything real estate related!" :
                (messages.length === 0 && this.state.context_id === 3 ? "Hi, I'm The Ultimate Real Estate Follow Up Helper. I'm here to help you gameplan your marketing efforts and stay organized!" : messages)))}
        </div>
        <div id="quick-actions">
          {this.state.context_id === 0 ? (
            <div className='menu-buttons'>{listingButtons}</div>
          ) : (this.state.context_id === 1 ? (
            <div className='menu-buttons'>{areaButtons}</div>
          ) : (this.state.context_id === 3 ?
            <div className='menu-buttons'>{followupButtons}</div>
            : ''))}

        </div>
        <div id="chat-input">
          <select className='Content-dropdown' onChange={this.changeContext} value={this.state.context_id}>
            {dropdownItems}
          </select>
          <form onSubmit={this.sendMessage}>
            <input
              value={this.state.messageInput}
              onChange={(e) => this.setState({ messageInput: e.target.value })}
              type="text"
              placeholder="Enter your message..."
              disabled={this.state.isLoading}
            />
            <button type="submit">Send</button>
            <button onClick={this.resetChat}>Reset Chat</button>
          </form>
        </div>
        <div id="footer">
          <span>Copyright © 2023 1parkplace, Inc. All rights reserved. - TheGenie.ai - US Patent #: 10,713,325</span>
        </div>
      </div>
    );
  }
}

export default App;

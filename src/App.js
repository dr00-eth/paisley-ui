import './App.css';
import React, { Component } from 'react';
import io from 'socket.io-client';
import { parse, Renderer } from 'marked';
import TurndownService from 'turndown';
import { LISTINGMENUITEMS as listingMenuItems, AREAMENUITEMS as areaMenuItems, FOLLOWUPMENUITEMS as followupMenuItems } from './constants'
import SmartMessageManager from './SmartMessageManager';
import {  
  showLoading, 
  hideLoading, 
  scrollToBottom, 
  autoGrowTextarea, 
  assignMessageIdToDisplayMessage,
  handleToggleFavorite,
  messageExists,
  resetChat,
  changeContext,
  handleMessage,
  userSelectedListing,
  userSelectedArea,
  userSelectedListingArea } from './helpers';
import { getUserAreas, getListingAreas, getUserListings, sendMessage, addMessage } from './utils';

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
    this.getAgentProfile = this.getAgentProfile.bind(this);
    this.getPropertyProfile = this.getPropertyProfile.bind(this);
    this.chatDisplayRef = React.createRef();
    this.listingSelectRef = React.createRef();
    this.textareaRef = React.createRef();
    this.apiServerUrl = 'https://paisley-api-develop-9t7vo.ondigitalocean.app';
    //this.apiServerUrl = 'http://127.0.0.1:8008';
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
    //CONNECT
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
    //MESSAGE
    this.socket.on('message', (data) => handleMessage(this, data));
    //EMIT_EVENT
    this.socket.on('emit_event', (data) => {
      const callbackData = {...data.callback_data};
      if (this.state.messagesTokenCount > 4000) {
        callbackData.messages = this.messageManager.getMessages();
      }

      // call the callback function with the data provided by the server
      this.socket.emit('callback_event', data.callback_data);
      this.setState({ incomingChatInProgress: true });
    });
    //MESSAGE_COMPLETE
    this.socket.on('message_complete', (data) => {
      const messageId = this.messageManager.addMessage("assistant", data.message);
      assignMessageIdToDisplayMessage(this, data.message, messageId);
      this.setState({ incomingChatInProgress: false });
      this.textareaRef.current.focus();
      console.log(this.messageManager.messages);
    });    
  }

  componentWillUnmount() {
    this.socket.off('message', this.handleMessage);
    this.socket.disconnect();
  }

  componentDidUpdate() {
    scrollToBottom(this);
  }

  async getAreaStatisticsPrompt(areaId, changeArea = false) {
    const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
    const areaStatsptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: areaId, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
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
      
        if (
          statistics.soldPropertyTypeCount > 0 &&
          (propTypeDescription === "Condo/Townhome" ||
          propTypeDescription === "Single Family Detached")
        ) {
          areaStatsPrompts.push(
            `For ${propTypeDescription} homes in the last ${lookback.lookbackMonths} months: avg. sale price $${statistics.averageSalePrice.toLocaleString()}, avg. ${statistics.averageDaysOnMarket} days on market, and avg. $${statistics.averagePricePerSqFt.toLocaleString()} per sq. ft.`
          );
        }
      }
      
    }
    const areaStatPrompt = areaStatsPrompts.join('\n');

    if (!changeArea) {
      await addMessage(this, "assistant", "Please provide the neighborhood, city, or zip code for the area you need marketing assistance with.");

      await addMessage(this, "user", areaStatPrompt);

    } else {
      await addMessage(this, "user", areaStatPrompt);

      await addMessage(this, "assistant", "I'll use this area's info for future recommendations.");
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

      await addMessage(this, "assistant", assistantPrompt);

      const listingPrompt = `New ${listingStatus} property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

      await addMessage(this, "user", listingPrompt);
    } else {
      const listingPrompt = `"New ${listingStatus} property for help at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

      await addMessage(this, "user", listingPrompt);

      const assistantPrompt = "I'll use this property's info and disregard previous listing info.";

      await addMessage(this, "assistant", assistantPrompt);
    }
    await getListingAreas(this);
    if (preferredAreaId > 0) {
      const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
      const areaStatsptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: preferredAreaId, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
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

      await addMessage(this, "assistant", "Do you have info about the area or neighborhood of this property?");

      await addMessage(this, "user", areaStatPrompt);
      this.setState({ selectedListingAreaId: preferredAreaId });
    }
    else {
      const areaStatsApi = `https://app.thegenie.ai/api/Data/GetZipCodeStatistics`;
      const areaStatsptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: listingInfo.zip, userId: this.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
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

      await addMessage(this, "assistant", "Do you have info about the area or neighborhood of this property?");

      await addMessage(this, "user", areaStatPrompt);
      this.setState({ selectedListingAreaId: areaId });
    }

    this.setState({ selectedListingAddress: listingAddress });
  }

  async getAgentProfile(event) {
    if (event) {
      event.preventDefault();
    }
    const userID = event ? event.target[0].value : this.state.agentProfileUserId;
    showLoading(this);
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
    await addMessage(this, "assistant", assistantPrompt, true);

    const agentPrompt = `Name: ${name}, display name: ${displayName} (use separate lines if different), email: ${email}, phone: ${phone}, website: ${website}, license: ${licenseNumber}, about: ${about}.`;
    await addMessage(this, "user", agentPrompt, true);

    this.setState({ isUserIdInputDisabled: true, agentName: name, agentProfileImage: agentProfileImage })
    getUserListings(this);
    getUserAreas(this);
    hideLoading(this);
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
    
            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }
    
            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }
    
            sendMessage(this, e);
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
    
            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }
    
            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }
    
            sendMessage(this, e);
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
    
            if (!messageExists(this, "user", userMessage)) {
              await addMessage(this, "user", userMessage, true);
            }
    
            if (!messageExists(this, "assistant", assistantMessage)) {
              await addMessage(this, "assistant", assistantMessage, true);
            }
    
            sendMessage(this, e);
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
            onClick={() => handleToggleFavorite(this, msg.id)}
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
                  <select ref={this.listingSelectRef} className='Content-dropdown' disabled={isUserListingSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedListing(this, e)}>
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
                  <select ref={this.areaSelectRef} className='Content-dropdown' disabled={isUserAreaSelectDisabled || incomingChatInProgress} onChange={(e) => userSelectedArea(this, e)}>
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
              onChange={(e) => changeContext(this, e)}
              value={context_id}
              disabled={isLoading || incomingChatInProgress}
            >
              {contextItems}
            </select>
            <form onSubmit={(e) => sendMessage(this, e)}>
              <textarea
                value={messageInput}
                ref={this.textareaRef}
                className="chat-input-textarea"
                onChange={(e) => this.setState({ messageInput: e.target.value })}
                onInput={() => autoGrowTextarea(this.textareaRef)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(this, e);
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
                  onClick={(e) => resetChat(this, e)}>Reset Chat</button>
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

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
      context_id: 0,
      agentProfileUserId: '',
      isUserIdInputDisabled: false,
      isUserListingSelectDisabled: false,
      isLoading: false,
      selectedListingMlsID: '',
      selectedListingMlsNumber: '',
      listings: [],
    };
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.getAgentProfile = this.getAgentProfile.bind(this);
    this.getPropertyProfile = this.getPropertyProfile.bind(this);
    this.resetChat = this.resetChat.bind(this);
    this.userSelectedListing = this.userSelectedListing.bind(this);
    this.chatDisplayRef = React.createRef();
    this.apiServerUrl = 'https://paisley-api-naqoz.ondigitalocean.app'
  }

  componentDidMount() {
    this.socket = io(this.apiServerUrl);
    this.socket.on('message', this.handleMessage);
    this.socket.on('connect', () => {
      console.log("Socket Connected:", this.socket.id);
      this.setState({ connection_id: this.socket.id }, () => {
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

  // function to show loading indicator/notification
  showLoading() {
    this.setState({ isLoading: true });
  }

  // function to hide loading indicator/notification
  hideLoading() {
    this.setState({ isLoading: false });
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
        this.setState({ messages: messages, displayMessages: [], isUserIdInputDisabled: false, agentProfileUserId: 0 });
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
    const priceStr = listingInfo.highPrice
      ? `${formatPrice(listingInfo.lowPrice)} - ${formatPrice(listingInfo.highPrice)}`
      : `${formatPrice(listingInfo.lowPrice)}`;
    const featuresStr = listingInfo.features.map(feature => `${feature.key}: ${feature.value}`).join(', ');

    const assistantPrompt = 'Do you have a specific MLS Listing that you\'d like help with today?';

    await this.addMessage("assistant", assistantPrompt);
    messages.push({ role: "assistant", content: assistantPrompt });

    const listingPrompt = `I have a new ${listingStatus} listing located at: ${listingAddress} listed for ${priceStr}!\nMLS Number: ${mlsNumber}\nVirtual Tour: ${virtualTourUrl}\nBedrooms: ${bedrooms}\nBathrooms: ${totalBathrooms}\nProperty Type: ${propertyType}\nCity: ${city}\nState: ${state}\nZip:${zip}\nSquare Feet: ${squareFeet}\nAcres: ${acres}\nGarage Spaces: ${garageSpaces}\nYear Built: ${yearBuilt}\nListing Agent: ${listingAgentName} (${listingBrokerName})\nListing Status: ${listingStatus}\nProperty Features: ${featuresStr}\nAdditional Property Details: ${remarks}`;

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
      messages.push({ role: "assistant", content: assistantPrompt });

      await this.addMessage("user", areaStatPrompt);
      messages.push({ role: "user", content: areaStatPrompt });
    }

    console.log(messages);
    this.setState({ messages: messages, isUserIdInputDisabled: true });
  }

  async getAgentProfile(event) {
    event.preventDefault();
    this.showLoading();
    const genieApi = `https://app.thegenie.ai/api/Data/GetUserProfile/${event.target[0].value}`;
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
    this.hideLoading();
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
    const contextOptions = [
      { value: 0, label: 'Listing Marketing' },
      { value: 1, label: 'Area Marketing' },
    ];
    const { isUserIdInputDisabled } = this.state;
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
        <div id="loading-container" style={{ display: this.state.isLoading ? 'flex' : 'none' }}>
          <p>Loading...</p>
        </div>
        <header className="App-header">
          <h1 className="App-title">TheGenie - Paisley Chat</h1>
          <select className='Content-dropdown' onChange={this.changeContext} value={this.state.context_id}>
            {dropdownItems}
          </select>
        </header>
        <div>
          <form className='user-form' onSubmit={this.getAgentProfile}>
            <label>User ID:</label>
            <input
              type="text"
              value={this.state.agentProfileUserId}
              placeholder="Enter AspNetUserID"
              onChange={(e) => this.setState({ agentProfileUserId: e.target.value })}
              disabled={isUserIdInputDisabled}
            />
            <button
              disabled={isUserIdInputDisabled}
              type="submit">Save</button>
          </form>
          {this.state.agentProfileUserId && this.state.listings.length > 0 && (
            <div className='listingSelectBox'>
              <label>Select Listing:</label>
              <select className='Content-dropdown' disabled={this.isUserListingSelectDisabled} onChange={this.userSelectedListing}>
                <option value="">-- Select Listing --</option>
                {this.state.listings.map((listing,index) => (
                  <option key={index} value={`${listing.mlsID}_${listing.mlsNumber}`}>
                    {listing.mlsNumber} - {listing.streetNumber} {listing.streetName} {listing.unitNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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
              disabled={this.state.isLoading}
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

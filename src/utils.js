import { waitForIncomingChatToFinish } from './helpers';

export function getUserAreas(context) {
    const { agentProfileUserId } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentProfileUserId, includeTerritories: false, consumer: 0 }),
    }
    fetch('https://app.thegenie.ai/api/Data/GetAvailableAreas', requestOptions)
        .then(response => response.json())
        .then(data => {
            const areas = data.areas;
            areas.sort((a, b) => b.hasBeenOptimized - a.hasBeenOptimized);
            // update state with fetched listings
            context.setState({ areas });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export async function getUserListings(context) {
    const {agentProfileUserId} = context.state;
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agentProfileUserId, includeOpenHouses: false }),
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
        context.setState({ listings });
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

export async function getListingAreas(context) {
    const { agentProfileUserId, selectedListingMlsID, selectedListingMlsNumber } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspNetUserId: agentProfileUserId, mlsID: selectedListingMlsID, mlsNumber: selectedListingMlsNumber, consumer: 0 }),
    }
    await fetch('https://app.thegenie.ai/api/Data/GetPropertySurroundingAreas', requestOptions)
        .then(response => response.json())
        .then(data => {
            const listingAreas = data.areas;
            listingAreas.sort((a, b) => b.areaApnCount - a.areaApnCount);
            // update state with fetched listing areas
            context.setState({ listingAreas });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export function generateAreaKit(context) {
    const {agentProfileUserId, selectedAreaId, selectedAreaName, displayMessages} = context.state;
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: agentProfileUserId, areaID: selectedAreaId, collection: 'market-report-kit', saveDB: true, async: false }),
    }
    fetch('https://hubsandbox.thegenie.ai/wp-json/genie/v1/create-render', requestOptions)
      .then(response => response.json())
      .then(data => {
        const collection = data.result.collection;
        const kitUrl = collection['collection-page'];
        const comment = `Here is your personalized area-focused kit for ${selectedAreaName}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${kitUrl}" target=_blank>Area Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`
        setTimeout(async () => {
          await waitForIncomingChatToFinish(context);
          const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
          context.setState({ displayMessages: updatedDisplayMessages, areaKitUrl: kitUrl });
        }, 30000);
      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

export function generateListingKit(context) {
    const {agentProfileUserId, selectedListingMlsID, selectedListingMlsNumber, selectedListingAddress, displayMessages} = context.state;
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: agentProfileUserId, collection: 'just-listed-kit', mlsNumber: selectedListingMlsNumber, mlsID: selectedListingMlsID, saveDB: true, async: false }),
    }
    fetch('https://hubsandbox.thegenie.ai/wp-json/genie/v1/create-render', requestOptions)
      .then(response => response.json())
      .then(data => {
        const collection = data.result.collection;
        const kitUrl = collection['collection-page'];
        const comment = `Here is your personalized listing-focused kit for ${selectedListingAddress}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${kitUrl}" target=_blank>Listing Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`
        setTimeout(async () => {
          await waitForIncomingChatToFinish(context);
          const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
          context.setState({ displayMessages: updatedDisplayMessages, listingKitUrl: kitUrl });
        }, 30000);

      })
      .catch(error => {
        // handle error
        console.error(error);
      });
  }

  export async function sendMessage(context, event) {
    event.preventDefault();
    const {messageInput, displayMessages, connection_id, context_id, gptModel} = context.state;
    if (messageInput) {
      const messageId = context.messageManager.addMessage("user", messageInput);
      const updatedDisplayMessages = [...displayMessages, {
        role: 'user',
        content: messageInput,
        id: messageId,
        isFav: false
      }];
      
      const requestBody = {
        message: messageInput,
        user_id: connection_id,
        context_id: context_id
      }

      if (gptModel !== null) {
        requestBody.model = gptModel;
      }

      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      };
      await fetch(`${context.apiServerUrl}/api/messages`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to send message');
          }
        })
        .catch(error => console.error(error));
      context.setState({ messages: context.messageManager.getMessages(), displayMessages: updatedDisplayMessages, messageInput: '' });

      const tokenChkBody = {
        messages: context.messageManager.getMessages(),
        model: gptModel
      }

      const tokenChkReq = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenChkBody)
      };

      await fetch(`${context.apiServerUrl}/api/gettokencount`, tokenChkReq)
        .then(response => response.json())
        .then(data => {
          if (data.tokencounts > 3000) {
            console.log("pruning tokens");
            context.messageManager.checkThresholdAndMove(.25);
            context.setState({ messages: context.messageManager.getMessages(), messagesTokenCount: data.tokencounts });
          }
          console.log(data.tokencounts);
        })
        .catch(error => console.error(error));
    }
  }

  export async function addMessage(context, role, message, isFav = false) {
    const {connection_id, context_id} = context.state;
    const streambotApi = `${context.apiServerUrl}/api/addmessages`;
    const addMsgRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role, message: message, user_id: connection_id, context_id: context_id })
    }
    try {
      await fetch(streambotApi, addMsgRequestOptions);
      context.messageManager.addMessage(role, message, isFav);
      context.setState({ messages: context.messageManager.getMessages() })

      //console.log(this.messageManager.messages);
    } catch (error) {
      console.error('Error in addMessage:', error);
    }
  }
import { waitForIncomingChatToFinish, updateConversation, createConversation } from './helpers';

export async function getUserAreas(context) {
    const { agentProfileUserId } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentProfileUserId, includeTerritories: false, consumer: 0 }),
    }
    await fetch('https://app.thegenie.ai/api/Data/GetAvailableAreas', requestOptions)
        .then(async response => await response.json())
        .then(async data => {
            const areas = data.areas;
            areas.sort((a, b) => b.hasBeenOptimized - a.hasBeenOptimized);
            // update state with fetched listings
            context.setStateAsync({ areas });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export async function getUserListings(context) {
    const { agentProfileUserId } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentProfileUserId, includeOpenHouses: false }),
    }
    await fetch('https://app.thegenie.ai/api/Data/GetAgentProperties', requestOptions)
        .then(async response => await response.json())
        .then(async data => {
            // filter properties with listDate > 60 days ago
            const listings = data.properties.filter(property => {
                const listDate = new Date(property.listDate);
                const daysAgo = (new Date() - listDate) / (1000 * 60 * 60 * 24);
                return daysAgo > 60;
            });

            // sort listings by listDate descending
            listings.sort((a, b) => new Date(b.listDate) - new Date(a.listDate));

            // update state with fetched listings
            context.setStateAsync({ listings });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export async function getAreaUserListings(context, areaId) {
    const { agentProfileUserId } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentProfileUserId, includeOpenHouses: false, areaId: areaId }),
    }
    await fetch('https://app.thegenie.ai/api/Data/GetAgentProperties', requestOptions)
        .then(async (response) => await response.json())
        .then(async (data) => {
            // filter properties with listDate > 60 days ago
            const areaUserListings = data.properties.filter(property => {
                const listDate = new Date(property.listDate);
                const daysAgo = (new Date() - listDate) / (1000 * 60 * 60 * 24);

                if (property.statusType !== "Sold") {
                    return true;
                } else {
                    return daysAgo < 90;
                }
            });
            // sort listings by listDate descending
            areaUserListings.sort((a, b) => new Date(b.listDate) - new Date(a.listDate));
            // update state with fetched listings
            await context.setStateAsync({ areaUserListings: areaUserListings });
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
        .then(async response => await response.json())
        .then(async (data) => {
            const listingAreas = data.areas.filter((area) => area.areaApnCount < 50000);
            listingAreas.sort((a, b) => b.areaApnCount - a.areaApnCount);
            // update state with fetched listing areas
            await context.setStateAsync({ listingAreas });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export function generateAreaKit(context) {
    const { agentProfileUserId, selectedAreaId, selectedAreaName } = context.state;
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
                const { displayMessages } = context.state;
                const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
                context.setState({ displayMessages: updatedDisplayMessages, areaKitUrl: kitUrl });
                updateConversation(context);
            }, 30000);
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

export function generateListingKit(context) {
    const { agentProfileUserId, selectedListingMlsID, selectedListingMlsNumber, selectedListingAddress } = context.state;
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
                const { displayMessages } = context.state;
                const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
                context.setState({ displayMessages: updatedDisplayMessages, listingKitUrl: kitUrl });
                updateConversation(context);
            }, 30000);

        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}

function adjustVibe(context, userMessage) {
    const { tone, writingStyle, targetAudience, messageInput } = userMessage;
    let vibedMessage = messageInput;
    if (tone) {
        switch (tone) {
            case 'friendly':
                vibedMessage += '. Your reply tone should be friendly';
                break;

            case 'conversational':
                vibedMessage += '. Your reply tone should be conversational';
                break;

            case 'emotional':
                vibedMessage += '. Your reply tone should be emotional';
                break;

            case 'to_the_point':
                vibedMessage += '. Your reply tone should be straight and to the point';
                break;
            default:
                break;
        }
    }
    if (writingStyle) {
        switch (writingStyle) {
            case 'luxury':
                vibedMessage += '. Your writing style should be smooth and focusing on luxury';
                break;

            case 'straightforward':
                vibedMessage += '. Your writing style should be straightforward and to the point';
                break;

            case 'professional':
                vibedMessage += '. Your writing style should be written professionally';
                break;

            default:
                break;
        }
    }
    if (targetAudience) {
        switch (targetAudience) {
            case 'first_time_home_buyers':
                vibedMessage += '. Your response should be targeted to first time home buyers';
                break;

            case 'sellers':
                vibedMessage += '. Your response should be targeted to home sellers';
                break;

            case '55plus':
                vibedMessage += '. Your response should be targeted at the 55+ retirement community';
                break;

            default:
                break;
        }
    }
    return vibedMessage;
}

export async function sendMessage(context, event) {
    event.preventDefault();
    const { displayMessages, connection_id, context_id, gptModel, userMessage, currentConversation } = context.state;

    if (userMessage) {
        if (userMessage.writingStyle || userMessage.tone || userMessage.targetAudience) {
            userMessage.vibedMessage = adjustVibe(context, userMessage);
        }
        const messageId = context.messageManager.addMessage("user", userMessage.vibedMessage !== '' ? userMessage.vibedMessage : userMessage.messageInput);
        const updatedDisplayMessages = [...displayMessages, {
            role: 'user',
            content: userMessage.messageInput,
            id: messageId,
            isFav: false,
            tone: userMessage.tone,
            writingStyle: userMessage.writingStyle,
            targetAudience: userMessage.targetAudience
        }];
        if (currentConversation !== '') {
            await updateConversation(context);
        } else {
            await createConversation(context, userMessage.messageInput.slice(0,30));
        }
        

        const requestBody = {
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
        await fetch(`${context.apiServerUrl}/api/chat`, requestOptions)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to send message');
                }
            })
            .catch(error => console.error(error));
        
        const newUserMessage = { ...userMessage, messageInput: "", vibedMessage: "" }
        await context.setStateAsync({ displayMessages: updatedDisplayMessages, userMessage: newUserMessage });

        const tokenChkBody = {
            messages: context.messageManager.getMessagesSimple(),
            model: gptModel
        }

        const tokenChkReq = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenChkBody)
        };

        await fetch(`${context.apiServerUrl}/api/gettokencount`, tokenChkReq)
            .then(async response => await response.json())
            .then(async (data) => {
                if (data.tokencounts > 3250) {
                    console.log("pruning tokens");
                    context.messageManager.checkThresholdAndMove(1);
                    updateConversation(context);
                    await context.setStateAsync({ messages: context.messageManager.messages, messagesTokenCount: data.tokencounts });
                }
                console.log(data.tokencounts);
            })
            .catch(error => console.error(error));

    }
}

export async function addMessage(context, role, message, isFav = false) {
    try {
        context.messageManager.addMessage(role, message, isFav);
        await context.setStateAsync({ messages: context.messageManager.messages })
    } catch (error) {
        console.error('Error in addMessage:', error);
    }
}

export async function getAgentProfile(context, event) {
    if (event) {
        event.preventDefault();
    }
    const userID = event ? event.target[0].value : context.state.agentProfileUserId;
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
    const profileImagePath = agentInfo.profileImagePath ?? '';
    const agentProfileImage = agentInfo.marketingSettings.images.find(image => image.marketingImageTypeId === 1)?.url ?? profileImagePath;

    const assistantPrompt = 'To assist you better, please provide more info about yourself and relevant details for content optimization.';
    await addMessage(context, "assistant", assistantPrompt, true);

    const agentPrompt = `Name: ${name}, display name: ${displayName} (use separate lines if different), email: ${email}, phone: ${phone}, website: ${website}, license: ${licenseNumber}, about: ${about}.`;
    await addMessage(context, "user", agentPrompt, true);

    await context.setStateAsync({ isUserIdInputDisabled: true, agentName: name, agentProfileImage: agentProfileImage })
    await getUserListings(context);
    await getUserAreas(context);
}

export async function getAreaStatisticsPrompt(context, areaId, changeArea = false) {
    const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
    const areaStatsptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: areaId, userId: context.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
    }
    const statsResults = await fetch(areaStatsApi, areaStatsptions);
    const { statistics } = await statsResults.json();

    const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
    const areaNameOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: areaId, userId: context.state.agentProfileUserId, consumer: 0 })
    }
    const nameResults = await fetch(areaNameApi, areaNameOptions);
    const { areaName } = await nameResults.json();
    await context.setStateAsync({ selectedAreaId: areaId, selectedAreaName: areaName });
    const areaStatsPrompts = [];

    if (!changeArea) {
        areaStatsPrompts.push(`Information for ${areaName} area:`);
    } else {
        areaStatsPrompts.push(`Please focus on ${areaName} and ignore any previous information provided.`);
    }

    if (context.state.areaUserListings.length > 0) {
        areaStatsPrompts.push(`I have some of my own listings to showcase in ${areaName}.`)

        for (const property of context.state.areaUserListings) {
            const listingAddress = property.streetNumber + ' ' + property.streetName + (property.unitNumber ? ` #${property.unitNumber}` : '');
            const mlsNumber = property.mlsNumber;
            const bedrooms = property.bedrooms;
            const totalBathrooms = property.bathroomsTotal;
            const propertyType = property.propertyTypeId === 0 ? 'Single Family Detached' : 'Condo/Townhome';
            const listingStatus = property.statusType;
            const soldDate = property.soldDate;
            const listDate = property.listDate;
            const squareFeet = property.sqft ?? 'Not provided';
            const formatPrice = (price) => {
                return `$${price.toLocaleString()}`;
            };
            const priceStr = listingStatus === "Sold"
                ? `sold ${soldDate} for ${formatPrice(property.salePrice)}`
                : (property.priceHigh
                    ? `listed ${listDate} for ${formatPrice(property.priceLow)} - ${formatPrice(property.priceHigh)}`
                    : `listed ${listDate} for ${formatPrice(property.priceLow)}`
                );

            const listingPrompt = `${listingStatus} status property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber} Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, Sq. Ft.: ${squareFeet}`;
            areaStatsPrompts.push(listingPrompt);
        }
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
        await addMessage(context, "assistant", "Please provide the neighborhood, city, or zip code for the area you need marketing assistance with.");

        await addMessage(context, "user", areaStatPrompt);

    } else {
        await addMessage(context, "user", areaStatPrompt);

        await addMessage(context, "assistant", "I'll use this area's info for future recommendations.");
    }
    return areaName;
}

export async function getPropertyProfile(context, mlsId, mlsNumber) {
    const genieApi = `https://app.thegenie.ai/api/Data/GetUserMlsListing`;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlsId: mlsId, mlsNumber: mlsNumber, userId: context.state.agentProfileUserId, consumer: 0 })
    }
    const genieResults = await fetch(genieApi, requestOptions);
    const { listing, ...rest } = await genieResults.json();
    const listingInfo = { ...listing };
    const fullResponse = { listing, ...rest };

    const listingAddress = listingInfo.listingAddress;
    await context.setStateAsync({ selectedListingAddress: listingAddress });
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

    const assistantPrompt = "Do you have a specific MLS Listing for help today?";

    await addMessage(context, "assistant", assistantPrompt);

    const listingPrompt = `New ${listingStatus} property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

    await addMessage(context, "user", listingPrompt);

    await getListingAreas(context);
    if (preferredAreaId > 0) {
        const areaStatsApi = `https://app.thegenie.ai/api/Data/GetAreaStatistics`;
        const areaStatsptions = {
            method: 'POST',
            headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaId: preferredAreaId, userId: context.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
        }
        const statsResults = await fetch(areaStatsApi, areaStatsptions);
        const { statistics } = await statsResults.json();

        const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
        const areaNameOptions = {
            method: 'POST',
            headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaId: preferredAreaId, userId: context.state.agentProfileUserId, consumer: 0 })
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

        await addMessage(context, "assistant", "Do you have info about the area or neighborhood of this property?");

        await addMessage(context, "user", areaStatPrompt);
        await context.setStateAsync({ selectedListingAreaId: preferredAreaId });
    }
    // else {
    //     const areaStatsApi = `https://app.thegenie.ai/api/Data/GetZipCodeStatistics`;
    //     const areaStatsptions = {
    //         method: 'POST',
    //         headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ zipCode: listingInfo.zip, userId: context.state.agentProfileUserId, consumer: 0, soldMonthRangeIntervals: [1, 3, 6] })
    //     }
    //     const statsResults = await fetch(areaStatsApi, areaStatsptions);
    //     const { statistics } = await statsResults.json();

    //     const areaNameApi = `https://app.thegenie.ai/api/Data/GetAreaName`;
    //     const areaNameOptions = {
    //         method: 'POST',
    //         headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ areaId: statistics[0].overallStatistics.id, userId: context.state.agentProfileUserId, consumer: 0 })
    //     }
    //     const nameResults = await fetch(areaNameApi, areaNameOptions);
    //     const { areaName, areaId } = await nameResults.json();

    //     const areaStatsPrompts = [];
    //     areaStatsPrompts.push(`This property exists in the ${areaName} zip code.`);

    //     for (const lookback of statistics) {
    //         areaStatsPrompts.push(`In the past ${lookback.lookbackMonths} months, ${lookback.overallStatistics.areaName} had ${lookback.overallStatistics.soldPropertyTypeCount} sales, avg. price $${lookback.overallStatistics.averageSalePrice.toLocaleString()}, and avg. ${lookback.overallStatistics.averageDaysOnMarket} days on market.`);

    //         const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

    //         if (propTypeStats.length > 0) {
    //             const propTypeDescription = propTypeStats[0].propertyTypeDescription;
    //             const statistics = propTypeStats[0].statistics;
    //             areaStatsPrompts.push(`For ${propTypeDescription} homes like this, avg. sale price: $${statistics.averageSalePrice.toLocaleString()}, avg. days on market: ${statistics.averageDaysOnMarket}, avg. price per sq. ft.: $${statistics.averagePricePerSqFt.toLocaleString()}."
    //         3.) "Property in ${areaName} zip code.`);
    //         }
    //     }
    //     const areaStatPrompt = areaStatsPrompts.join('\n');

    //     await addMessage(context, "assistant", "Do you have info about the area or neighborhood of this property?");

    //     await addMessage(context, "user", areaStatPrompt);
    //     await context.setStateAsync({ selectedListingAreaId: areaId });
    // }
    return listingAddress;
}
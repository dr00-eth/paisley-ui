import { showLoading, hideLoading } from './helpers';
import { waitForIncomingChatToFinish, updateConversation, createConversation } from './helpers';
import { writingStyleOptions, toneOptions, targetAudienceOptions, formatOptions } from './vibes';
import { IntercomProvider } from 'react-use-intercom';

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
            await context.setStateAsync({ areas });
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
                if (property.statusType !== "Sold") {
                    return true;
                } else {
                    return daysAgo < 60;
                }
            });

            // sort listings by listDate descending
            listings.sort((a, b) => new Date(b.listDate) - new Date(a.listDate));

            // update state with fetched listings
            await context.setStateAsync({ listings });
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
    const { agentProfileUserId, selectedListingMlsID, selectedListingMlsNumber, selectedProperty, context_id } = context.state;

    const requestBody = {
        aspNetUserId: agentProfileUserId,
        consumer: 0
    };

    if (context_id === 5 && selectedProperty) {
        requestBody.fips = selectedProperty.fips;
        requestBody.propertyID = parseInt(selectedProperty.propertyID);
    }

    if (context_id === 0 && selectedListingMlsID && selectedListingMlsNumber) {
        requestBody.mlsID = selectedListingMlsID;
        requestBody.mlsNumber = selectedListingMlsNumber;
    }

    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

export async function getAddressSuggestions(context, address) {
    const { agentProfileUserId } = context.state;
    const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address, sessionToken: agentProfileUserId, consumer: 0 }),
    }

    const response = await fetch('https://app.thegenie.ai/api/Data/GetAddressPredictions', requestOptions)
        .then(async response => await response.json()
            .then(async (data) => {
                if (data.success) {
                    return data.predictions.map((prediction) => ({
                        fullAddress: prediction.fullAddress,
                        key: prediction.key
                    }));
                } else {
                    return [];
                }
            })
            .catch(error => {
                console.log(error);
            }));
    return response;
};

export function getSuggestionValue(suggestion) {
    return suggestion.fullAddress;
};

export function renderSuggestion(suggestion, context) {
    async function handleSelect(id, context) {
        const requestOptions = {
            method: 'POST',
            headers: {
                Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`,
                'Content-Type': 'application/json',
            },
        };
        showLoading(context);
        const response = await fetch(
            `https://app.thegenie.ai/api/Data/GetAssessorPropertiesDetail/${id}`,
            requestOptions
        );
        const data = await response.json();
        if (data.success) {
            const properties = data.properties;
            if (properties.length === 1) {
                const isPropertyChange = properties[0] === context.state.selectedProperty;
                await context.setStateAsync({ selectedProperty: properties[0] });
                await buildPropertyDescription(context);
                if (!isPropertyChange) {
                    await createConversation(context, `${properties[0].siteAddress}`);
                } else {
                    await updateConversation(context);
                }
            } else if (properties.length > 1) {
                // Add properties to foundProperties state array
                context.setState({
                    foundProperties: properties,
                });

                const propertyButtons = properties.map((property) => {
                    const buttonLabel = `${property.siteAddressHouseNumber} ${property.siteAddressStreetName
                        }${property.siteAddressUnitNumber ? `, ${property.siteAddressUnitNumber}` : ''}`;
                    return {
                        label: buttonLabel,
                        value: `${property.fips}_${property.propertyID}`,
                    };
                });

                const swalHTML = (
                    <div>
                        {propertyButtons.map((button) => (
                            <button
                                key={button.value}
                                value={button.value}
                                onClick={async (e) => {
                                    e.preventDefault();
                                    await userSelectedProperty(button.value, context, properties);
                                    context.MySwal.close();
                                }}
                            >
                                {button.label}
                            </button>
                        ))}
                    </div>
                );

                const swalOptions = {
                    title: 'Select a property',
                    html: swalHTML,
                    showConfirmButton: false,
                };

                await context.MySwal.fire(swalOptions);
            }
        }
        hideLoading(context);
    }

    return (
        <div onClick={async (e) => {
            e.preventDefault();
            await handleSelect(suggestion.key, context);
        }}>
            {suggestion.fullAddress}
        </div>
    );
}

export async function userSelectedProperty(value, context) {
    const [fips, propertyID] = value.split('_');
    const property = context.state.foundProperties.find(prop => prop.fips === fips && prop.propertyID === parseInt(propertyID));
    const isPropertyChange = property === context.state.selectedProperty;
    if (property) {
        await context.setStateAsync({ selectedProperty: property });
        showLoading(context);
        await buildPropertyDescription(context);
        if (!isPropertyChange) {
            await createConversation(context, `${property.siteAddress}`);
        } else {
            await updateConversation(context);
        }

        hideLoading(context);
    }
};

export async function onSuggestionsFetchRequested({ value }, context) {
    const addressSuggestions = await getAddressSuggestions(context, value);
    await context.setStateAsync({ addressSuggestions });
};

export function onSuggestionsClearRequested(context) {
    context.setState({ suggestions: [] });
};

export function autoSuggestOnChange(event, { newValue }, context) {
    context.setState({ addressSearchString: newValue })
}

export function createShortUrl(context, url) {
    const { agentProfileUserId, agentName } = context.state;
    const shortUrlApi = `https://app.thegenie.ai/api/Data/GenerateShortUrl`;
    const urlOptions = {
        method: 'POST',
        headers: { Authorization: `Basic MXBwSW50ZXJuYWw6MXBwMW43NCEhYXo=`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentProfileUserId, destinationUrl: url, data: { "utm_source": "paisley", "client_name": agentName }, consumer: 0 })
    };

    return fetch(shortUrlApi, urlOptions)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.url;
            } else {
                throw new Error('Failed to generate short URL');
            }
        })
        .catch(error => {
            console.error(error);
            throw error;
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
            createShortUrl(context, kitUrl)
                .then(shortUrl => {
                    const comment = `Here is your personalized area-focused kit for ${selectedAreaName}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${shortUrl ?? kitUrl}" target=_blank>Area Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`;

                    // Get the currentConversation value here
                    const { currentConversation } = context.state;
                    setTimeout(async () => {
                        // Check if currentConversation has changed
                        if (currentConversation !== context.state.currentConversation) {
                            return;
                        }
                        await waitForIncomingChatToFinish(context);
                        const { displayMessages } = context.state;
                        const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
                        await context.setStateAsync({ displayMessages: updatedDisplayMessages, areaKitUrl: shortUrl ?? kitUrl });
                        await updateConversation(context);
                    }, 30000);
                })
                .catch(error => {
                    console.error(error);
                });
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
            createShortUrl(context, kitUrl)
                .then(shortUrl => {
                    const comment = `Here is your personalized listing-focused kit for ${selectedListingAddress}, complete with various assets for you to download and use to promote your listing and generate engagement.\n\nTo access your kit, click on the link:\n\n<a href="${shortUrl ?? kitUrl}" target=_blank>Listing Kit</a>\n\nOnce you have accessed your kit, you will see a variety of assets, including social media posts, mailers, graphics, and infographics. Some of these assets may be still loading, so be sure to wait a few moments for everything to fully load.\n\nChoose the assets you want to use and feel free to ask any questions to me about implementation. With our kit, you'll be able to showcase the unique features of your listing and generate more engagement in no time.\n\nThank you for choosing TheGenie. We hope you find our kit helpful in your marketing efforts!`;

                    // Get the currentConversation value here
                    const { currentConversation } = context.state;
                    setTimeout(async () => {
                        // Check if currentConversation has changed
                        if (currentConversation !== context.state.currentConversation) {
                            return;
                        }
                        await waitForIncomingChatToFinish(context);
                        const { displayMessages } = context.state;
                        const updatedDisplayMessages = [...displayMessages, { role: "assistant", content: comment, isKit: true }];
                        await context.setStateAsync({ displayMessages: updatedDisplayMessages, listingKitUrl: shortUrl ?? kitUrl });
                        await updateConversation(context);
                    }, 30000);
                })
                .catch(error => {
                    console.error(error);
                });
        })
        .catch(error => {
            // handle error
            console.error(error);
        });
}


function adjustVibe(userMessage) {
    const { messageInput } = userMessage;
    let vibedMessage = messageInput;

    const allOptions = {
        tone: toneOptions,
        writingStyle: writingStyleOptions,
        targetAudience: targetAudienceOptions,
        format: formatOptions,
    };

    Object.entries(allOptions).forEach(([key, options]) => {
        const selectedOption = options.find((option) => option.value === userMessage[key]);
        if (selectedOption) {
            vibedMessage += selectedOption.vibeString;
        }
    });

    return vibedMessage;
}

export async function sendMessage(context) {
    const { displayMessages, connection_id, context_id, gptModel, userMessage, currentConversation } = context.state;

    if (userMessage.messageInput && userMessage.messageInput !== '') {
        if (userMessage.writingStyle || userMessage.tone || userMessage.targetAudience || userMessage.format) {
            userMessage.vibedMessage = adjustVibe(userMessage);
        }
        const messageId = context.messageManager.addMessage("user", userMessage.vibedMessage !== '' ? userMessage.vibedMessage : userMessage.messageInput);
        const updatedDisplayMessages = [...displayMessages, {
            role: 'user',
            content: userMessage.messageInput,
            id: messageId,
            isFav: false,
            tone: userMessage.tone,
            writingStyle: userMessage.writingStyle,
            targetAudience: userMessage.targetAudience,
            format: userMessage.format
        }];
        //We push this ASAP before hitting /api/chat to avoid appening GPT response to previous response
        await context.setStateAsync({ displayMessages: updatedDisplayMessages });

        if (currentConversation !== '') {
            await updateConversation(context);
        } else {
            await createConversation(context, userMessage.messageInput.slice(0, 30));
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
                if (data.tokencounts > 3000) {
                    await context.messageManager.checkThresholdAndMove(context, data.tokencounts);
                    updateConversation(context);
                    await context.setStateAsync({ messagesTokenCount: data.tokencounts });
                }
            })
            .catch(error => console.error(error));

        const newUserMessage = { ...userMessage, messageInput: "", vibedMessage: "", tone: "", writingStyle: "", targetAudience: "", format: "" };
        await context.setStateAsync({ userMessage: newUserMessage });
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
    const accountEmail = agentInfo.emailAddress;
    const email = agentInfo.marketingSettings.profile.email ?? accountEmail;
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

    await context.setStateAsync({ isUserIdInputDisabled: true, agentName: name, agentProfileImage: agentProfileImage, accountEmail: accountEmail });
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
    const { statistics, predominateListingZipCode } = await statsResults.json();

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
        areaStatsPrompts.push(`Information for ${areaName} (located in ${predominateListingZipCode}) area:`);
    } else {
        areaStatsPrompts.push(`Please focus on ${areaName} (located in ${predominateListingZipCode}) and ignore any previous area information provided (if any).`);
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
                : (property.priceHigh && property.priceHigh !== property.priceLow
                    ? `listed ${listDate} for ${formatPrice(property.priceLow)} - ${formatPrice(property.priceHigh)}`
                    : `listed ${listDate} for ${formatPrice(property.priceLow)}`
                );

            const listingPrompt = `${listingStatus} status property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber} Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, Sq. Ft.: ${squareFeet}`;
            areaStatsPrompts.push(listingPrompt);
        }
    }

    statistics.forEach((lookback, index) => {
        if (index === 0) {
            areaStatsPrompts.push(
                `${areaName} contains ${lookback.overallStatistics.taxrollCount} properties.`
            );
        }

        areaStatsPrompts.push(
            `In the past ${lookback.lookbackMonths} months there were ${lookback.overallStatistics.soldPropertyTypeCount} sales, avg. price $${lookback.overallStatistics.averageSalePrice.toLocaleString()}, and avg. ${lookback.overallStatistics.averageDaysOnMarket} days on market.`
        );

        lookback.propertyTypeStatistics.forEach((propLookback) => {
            const propTypeDescription = propLookback.propertyTypeDescription;
            const statistics = propLookback.statistics;

            if (
                statistics.soldPropertyTypeCount > 0 &&
                (propTypeDescription === "Condo/Townhome" ||
                    propTypeDescription === "Single Family Detached")
            ) {
                if (index === 0) {
                    areaStatsPrompts.push(
                        `There are ${statistics.taxrollCount} ${propTypeDescription} homes.`
                    );
                }
                areaStatsPrompts.push(
                    `For ${propTypeDescription} homes in the last ${lookback.lookbackMonths} months: avg. sale price $${statistics.averageSalePrice.toLocaleString()}, avg. ${statistics.averageDaysOnMarket} days on market, and avg. $${statistics.averagePricePerSqFt.toLocaleString()} per sq. ft.`
                );
            }
        });
    });

    const areaStatPrompt = areaStatsPrompts.join('\n');

    if (!changeArea) {
        await addMessage(context, "assistant", "Please provide the neighborhood, city, or zip code for the area you need marketing assistance with.", true);

        await addMessage(context, "user", areaStatPrompt, true);

    } else {
        await addMessage(context, "user", areaStatPrompt, true);

        await addMessage(context, "assistant", "I'll use this area's info for future recommendations.", true);
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
        : (listingInfo.highPrice && listingInfo.highPrice !== listingInfo.lowPrice
            ? `${formatPrice(listingInfo.lowPrice)} - ${formatPrice(listingInfo.highPrice)}`
            : `${formatPrice(listingInfo.lowPrice)}`
        );
    const featuresStr = listingInfo.features.map(feature => `${feature.key}: ${feature.value}`).join(', ');

    const assistantPrompt = "Do you have a specific MLS Listing for help today?";

    await addMessage(context, "assistant", assistantPrompt, true);

    const listingPrompt = `New ${listingStatus} property at ${listingAddress}: ${priceStr}, MLS: ${mlsNumber}, Virtual Tour: ${virtualTourUrl}, Beds: ${bedrooms}, Baths: ${totalBathrooms}, Type: ${propertyType}, City: ${city}, State: ${state}, Zip: ${zip}, Sq. Ft.: ${squareFeet}, Acres: ${acres}, Garage: ${garageSpaces}, Year Built: ${yearBuilt}, Agent: ${listingAgentName} (${listingBrokerName}), Status: ${listingStatus}, Features: ${featuresStr}, Details: ${remarks}. Note: Details don't change with status; don't use status info from that field.`;

    await addMessage(context, "user", listingPrompt, true);

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

        statistics.forEach((lookback, index) => {
            if (index === 0) {
                areaStatsPrompts.push(`${areaName} contains ${lookback.overallStatistics.taxrollCount} properties.`);
            }

            const propTypeStats = lookback.propertyTypeStatistics.filter(statistic => statistic.propertyTypeId === propertyTypeId);

            if (propTypeStats.length > 0) {
                const propTypeDescription = propTypeStats[0].propertyTypeDescription;
                const statistics = propTypeStats[0].statistics;
                if (index === 0) {
                    areaStatsPrompts.push(`There are ${statistics.taxrollCount} ${propTypeDescription} homes.`)
                }
                areaStatsPrompts.push(`For ${propTypeDescription} homes in the last ${lookback.lookbackMonths} months: avg. sale price $${statistics.averageSalePrice.toLocaleString()}, avg. ${statistics.averageDaysOnMarket} days on market, and avg. $${statistics.averagePricePerSqFt.toLocaleString()} per sq. ft.`);
            }
        });

        const areaStatPrompt = areaStatsPrompts.join('\n');

        await addMessage(context, "assistant", "Do you have info about the area or neighborhood of this property?", true);

        await addMessage(context, "user", areaStatPrompt, true);
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

    //     await addMessage(context, "assistant", "Do you have info about the area or neighborhood of this property?", true);

    //     await addMessage(context, "user", areaStatPrompt);
    //     await context.setStateAsync({ selectedListingAreaId: areaId });
    // }
    return listingAddress;
}

export async function buildPropertyDescription(context) {
    const { selectedProperty } = context.state;
    const formatPrice = (price) => {
        if (price && price !== 0) {
            return `$${price.toLocaleString()}`;
        }
        return 'unknown';
    };
    const {
        ownerDisplayName,
        siteAddress,
        siteAddressCity,
        siteAddressZip,
        propertyType,
        yearBuilt,
        lotSqFt,
        sumBuildingSqFt,
        saleDate,
        salePrice,
        firstAmericanCurrentAVM,
        bedrooms,
        bathrooms,
        mlsProperties
    } = selectedProperty;
    const propertyPrompts = []
    propertyPrompts.push(`The property at ${siteAddress} is located in ${siteAddressCity}, with the zip code ${siteAddressZip}. It last sold on ${saleDate} for ${formatPrice(salePrice ?? 0)}. Current estimated value is ${firstAmericanCurrentAVM}. The property features ${bedrooms} bedrooms and ${bathrooms} bathrooms, with a total square footage of ${sumBuildingSqFt}. It was built in ${yearBuilt} and sits on a ${lotSqFt} square foot lot. The property type is ${propertyType.trim() === '1001' ? 'Single Family Detached' : 'Condo/Townhome/Other'}. The property is owned by ${ownerDisplayName}.`);

    if (mlsProperties && mlsProperties.length > 0) {
        if (mlsProperties && mlsProperties.length > 0) {
            mlsProperties.forEach((listing, index) => {
                const { mlsName, mlsNumber, propertyType, saleType, statusType, listDate, soldDate, priceLow, priceHigh, salePrice, daysOnMarket, remarks } = listing;
                const priceStr = priceHigh && priceHigh !== priceLow
                    ? `${formatPrice(priceLow)} - ${formatPrice(priceHigh)}`
                    : `${formatPrice(priceLow)}`;
                const prompt = `Previous listed ${propertyType} in ${mlsName} on ${listDate} as ${saleType} for ${priceStr}. Current Status: ${statusType}. MLS #${mlsNumber} ${soldDate ? `Sold on ${soldDate} for ${formatPrice(salePrice)} after ${daysOnMarket} days on market.` : ''}`;
                
                // Add remarks to the first prompt only
                if (index === 0 && remarks !== '') {
                    propertyPrompts.push(`${prompt} Previous MLS/Property Description: ${remarks}`);
                } else {
                    propertyPrompts.push(prompt);
                }
            });
        }
        
    }

    const propertyPrompt = propertyPrompts.join('\n').trim();

    await addMessage(context, "assistant", "Do you have info about the property?", true);

    await addMessage(context, "user", propertyPrompt, true);

    await getListingAreas(context);
}

export function initIntercom(context) {
    const { privateMode, agentName, accountEmail, agentProfileUserId } = context.state;
    if (!privateMode) {
        return (
            <IntercomProvider
                initializeDelay="2000"
                appId="m7py7ex5"
                autoBoot="true"
                autoBootProps={
                    {
                        name: agentName,
                        email: accountEmail,
                        userId: agentProfileUserId,
                        alignment: "right",
                        verticalPadding: 20
                    }
                }
            />
        )
    }
}
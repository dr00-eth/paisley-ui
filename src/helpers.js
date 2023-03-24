import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    generateListingKit,
    generateAreaKit,
    getAreaStatisticsPrompt,
    getPropertyProfile,
    getAreaUserListings,
    getAgentProfile,
    addMessage,
    sendMessage
} from "./utils";

export function showLoading(context) {
    context.setState({ isLoading: true });
}

export function hideLoading(context) {
    context.setState({ isLoading: false });
}

export function scrollToBottom(context) {
    if (context.chatDisplayRef.current) {
        context.chatDisplayRef.current.scrollTop = context.chatDisplayRef.current.scrollHeight;
    }
}

export function autoGrowTextarea(textareaRef) {
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

export async function waitForIncomingChatToFinish(context) {
    const { incomingChatInProgress } = context.state;
    while (incomingChatInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
    }
}

export async function assignMessageIdToDisplayMessage(context, content, messageId) {
    const updatedDisplayMessages = context.state.displayMessages.map(msg => {
        if (msg.content === content) {
            return { ...msg, id: messageId };
        }
        return msg;
    });
    await context.setStateAsync({ displayMessages: updatedDisplayMessages });
}

export function handleToggleFavorite(context, id) {
    context.messageManager.toggleFavorite(id);
    context.setState({ messages: context.messageManager.messages }, () => {
        updateDisplayMessagesWithFavorites(context);
    });
}

export function updateDisplayMessagesWithFavorites(context) {
    const { displayMessages } = context.state;
    const messageManagerMessages = context.messageManager.messages;
    const updatedDisplayMessages = displayMessages.map(msg => {
        const updatedMessage = messageManagerMessages.find(m => m.id === msg.id);
        return updatedMessage ? updatedMessage : msg;
    });
    context.setState({ displayMessages: updatedDisplayMessages });
}

export function messageExists(context, role, content) {
    const messages = context.messageManager.getMessagesSimple();
    return messages.some(message => message.role === role && message.content === content);
}

export async function resetChat(context, event) {
    event.preventDefault();
    const { userMessage } = context.state;
    showLoading(context);
    const newUserMessage = { ...userMessage, messageInput: "", vibedMessage: "" };
    try {
        await context.setStateAsync({
            messages: context.messageManager.resetMessages(),
            userMessage: newUserMessage,
            displayMessages: [],
            isUserListingSelectDisabled: false,
            selectedListingMlsID: '',
            selectedListingMlsNumber: '',
            selectedAreaId: 0,
            selectedListingAreaId: 0,
            currentConversation: ''
        });
        await fetch(`${context.apiServerUrl}/api/getmessages/${context.state.context_id}/${context.state.connection_id}`)
            .then(async response => await response.json())
            .then(async (data) => {
                for (const message of data) {
                    context.messageManager.addMessage(message.role, message.content, true);
                }
            })
            .catch(error => console.error(error));
        if (context.state.context_id !== 4) {
            await getAgentProfile(context);
        }
        hideLoading(context);
    } catch (error) {
        hideLoading(context);
        console.error(error);
    }
}

export async function resetConversation(context, event) {
    event.preventDefault();
    const { userMessage } = context.state;
    showLoading(context);
    const newUserMessage = { ...userMessage, messageInput: "", vibedMessage: "" };
    try {
        if (context.state.currentConversation !== '') {
            await context.setStateAsync({
                messages: context.messageManager.cleanMessages(),
                userMessage: newUserMessage,
                displayMessages: [],
            });
            console.log(context.messageManager.messages);
            await updateConversation(context);
        }
        hideLoading(context);
    } catch (error) {
        console.error(error);
        hideLoading(context);
    }
}

export async function changeContext(context, event) {
    const { connection_id } = context.state;
    const newContextId = parseInt(event.target.value);
    await context.setStateAsync({ context_id: newContextId, messages: context.messageManager.resetMessages(), displayMessages: [], currentConversation: '' });
    await fetch(`${context.apiServerUrl}/api/getmessages/${newContextId}/${connection_id}`)
        .then(async response => await response.json())
        .then(async (data) => {
            for (const message of data) {
                context.messageManager.addMessage(message.role, message.content, true);
            }
            if (newContextId !== 4) {
                showLoading(context);
                await getAgentProfile(context);
                hideLoading(context);
            }
        })
        .catch(error => console.error(error));
}

export function handleMessage(context, data) {
    const displayMessages = context.state.displayMessages.slice();
    const latestDisplayMsg = displayMessages[displayMessages.length - 1];
    if (latestDisplayMsg && latestDisplayMsg.role === "assistant") {
        // Append incoming message to the latest assistant message
        latestDisplayMsg.content += data.message;
    } else {
        clearTimeout(context.alertTimeout);
        context.setState({ isWaitingForMessages: false });
        // Add a new assistant message with the incoming message
        displayMessages.push({ role: "assistant", content: data.message, isFav: false });
    }
    context.setState({ displayMessages: displayMessages });
}

export async function userSelectedListing(context, event) {
    event.preventDefault();
    const { selectedListingMlsNumber } = context.state;
    const [mlsID, mlsNumber] = event.target.value.split('_');

    showLoading(context);

    if (selectedListingMlsNumber && selectedListingMlsNumber !== mlsNumber) {
        await resetChat(context, event);
    }
    await context.setStateAsync({
        selectedListingMlsID: mlsID,
        selectedListingMlsNumber: mlsNumber
    });

    const listingAddress = await getPropertyProfile(context, mlsID, mlsNumber);
    generateListingKit(context);
    await createConversation(context, `${listingAddress}`);

    hideLoading(context);
}


export async function userSelectedArea(context, event) {
    event.preventDefault();
    const { selectedAreaId } = context.state;
    const areaId = event.target.value;
    showLoading(context);

    if (selectedAreaId && selectedAreaId !== areaId) {
        await resetChat(context, event);
    }

    await context.setStateAsync({
        selectedAreaId: areaId,
    });

    await getAreaUserListings(context, areaId);
    const areaName = await getAreaStatisticsPrompt(context, areaId);

    generateAreaKit(context);

    await createConversation(context, `${areaName}`);
    hideLoading(context);
}

export async function userSelectedListingArea(context, event) {
    event.preventDefault();
    const selectedListingAreaId = event.target.value;
    const isAreaChange = selectedListingAreaId === context.state.selectedListingAreaId;

    await context.setStateAsync({
        selectedListingAreaId,
    });

    showLoading(context);
    await getAreaStatisticsPrompt(
        context,
        selectedListingAreaId,
        isAreaChange
    );
    generateAreaKit(context);
    hideLoading(context);
}

export async function userSelectedConversation(context, event) {
    event.preventDefault();
    const conversationId = event.target.value;
    showLoading(context);
    await fetchConversation(context, conversationId);
    hideLoading(context);
    await context.setStateAsync({
        currentConversation: conversationId
    });
}

async function getEnhancedPrompt(text) {
    try {
        const stopSequence = 'END_OF_IMPROVED_TEXT';
        const prompt = `We have the following input text in English: "${text}". Please provide a more informative and clear version of this text, which will help a GPT model better understand the user's desired action.\n2. Rewrite the main idea in a clear and informative manner.\n3. Make sure the new text is in English and easy to understand but more clear than the input text.\n\nImproved text: ${stopSequence}`;
        const requestOptions = {
            method: 'POST',
            headers: { Authorization: 'Bearer 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', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'text-davinci-003', prompt: prompt, max_tokens: 75, temperature: 1, stop: [stopSequence] }),
        };
        const response = await fetch(`https://api.openai.com/v1/completions`, requestOptions);
        const enhancedPrompt = await response.json();
        if (!enhancedPrompt.choices || !enhancedPrompt.choices.length) {
            throw new Error('Failed to enhance prompt');
        }

        const enhancedText = enhancedPrompt.choices[0].text.replace(stopSequence, '').replace('"', '').trim();
        return enhancedText;
    } catch (error) {
        console.error('Error enhancing prompt:', error);
        return text;
    }
}

export async function handleEnhancePromptClick(context, event) {
    event.preventDefault();
    const { userMessage } = context.state;
    if (userMessage.messageInput.trim() === "") return;

    try {
        showLoading(context);
        const enhancedMessage = await getEnhancedPrompt(userMessage.messageInput);
        const newUserMessage = { ...userMessage, messageInput: enhancedMessage };
        hideLoading(context);
        context.setState({ userMessage: newUserMessage });
    } catch (error) {
        hideLoading(context);
        console.error("Error enhancing message:", error);
    }
}

export function toggleSwapVibe(context, e) {
    e.preventDefault();
    context.setState((prevState) => ({
        isSwapVibeCollapsed: !prevState.isSwapVibeCollapsed,
    }));
};

export function handleWritingStyleChange(context, e) {
    e.preventDefault();
    const newUserMessage = { ...context.state.userMessage, writingStyle: e.target.value };
    context.setState({ userMessage: newUserMessage });
};

export function handleToneChange(context, e) {
    e.preventDefault();
    const newUserMessage = { ...context.state.userMessage, tone: e.target.value };
    context.setState({ userMessage: newUserMessage });
};

export function handleTargetAudienceChange(context, e) {
    e.preventDefault();
    const newUserMessage = { ...context.state.userMessage, targetAudience: e.target.value };
    context.setState({ userMessage: newUserMessage });
};

export function formatKey(str) {
    return str
        .replace('plus', '+')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export function createButtons(context, menuItems, userMessage, isLoading, incomingChatInProgress) {
    const MySwal = withReactContent(Swal);
    return menuItems.map((option, index) => {
        return (
            <button
                key={index}
                className={isLoading || incomingChatInProgress || (context.state.context_id === 0 && context.state.selectedListingMlsNumber === '') || (context.state.context_id === 1 && context.state.selectedAreaId === 0) ? 'disabled' : ''}
                value={option.value}
                onClick={async (e) => {
                    if (isLoading || incomingChatInProgress || (context.state.context_id === 0 && context.state.selectedListingMlsNumber === '') || (context.state.context_id === 1 && context.state.selectedAreaId === 0)) {
                        MySwal.fire({
                            title: 'Quick Actions',
                            text: `Please select a ${context.state.context_id === 0 ? 'listing' : 'area'} to use Quick Actions!`,
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                    } else {
                        const newUserMessage = { ...userMessage, messageInput: e.target.value };
                        await context.setStateAsync({ userMessage: newUserMessage });
                        const userMessagePrompt = option.customPrompt;
                        const assistantMessage = `When you say "${option.value}" I will produce a response following this definition`;

                        if (!messageExists(context, "user", userMessagePrompt)) {
                            await addMessage(context, "user", userMessagePrompt, true);
                        }

                        if (!messageExists(context, "assistant", assistantMessage)) {
                            await addMessage(context, "assistant", assistantMessage, true);
                        }

                        await sendMessage(context, e);
                    }

                }}>
                {option.label}
            </button>
        );
    });
}

export const startMessage = () => {
    return (
        <div>
            <h1>Welcome to Paisley</h1><h2><i>Your ultimate real estate productivity booster and colleague!</i></h2>
            <p>To get started, simply type in your question or prompt in the chat bar on the bottom of your screen or select a Quick Action.</p>
            <p>Whether you need help generating Facebook copy, creating a neighborhood guide, or writing a blog post, Paisley is here to assist you every step of the way.</p>
            <p>Need some inspiration? Here are a few example prompts to get your creative juices flowing: </p>
            <ul>
                <li>"Hey Paisley, can you help me write a blog post about the best schools in the area?"</li>
                <li>"Paisley, can you generate Facebook copy for my new listing?"</li>
                <li>"I need to create a neighborhood guide for the area. Can you help me get started, Paisley?"</li>
                <li>"Can you help me create a seller-focused marketing plan, Paisley?"</li>
                <li>"I'm looking to create a buyer-focused marketing campaign. Can you assist me, Paisley?"</li>
            </ul>
            <p>Don't forget, you can also use the menu below to switch between listing-focused, area-focused, coach Paisley, and follow-up Paisley.</p>
            <p>Additionally, quick action buttons are available on the menu bar to get you started on using Paisley as a jumping off point.</p>
            <p>So what are you waiting for? Let Paisley help take your real estate business to the next level.</p>
        </div>
    )
};

function getSimplifiedState(context) {
    return {
        messages: context.messageManager.messages,
        displayMessages: context.state.displayMessages,
        context_id: context.state.context_id,
        agentProfileUserId: context.state.agentProfileUserId,
        gptModel: context.state.gptModel,
        selectedListingMlsID: context.state.selectedListingMlsID,
        selectedListingMlsNumber: context.state.selectedListingMlsNumber,
        selectedListingAreaId: context.state.selectedListingAreaId,
        selectedAreaName: context.state.selectedAreaName,
        selectedAreaId: context.state.selectedAreaId,
        selectedListingAddress: context.state.selectedListingAddress,
        selectedProperty: context.state.selectedProperty,
        foundProperties: context.state.foundProperties,
        listingAreas: context.state.listingAreas,
        deletedMsgs: context.state.deletedMsgs,
        currentConversation: context.state.currentConversation,
        isAddressSearchDisabled: context.state.isAddressSearchDisabled,
        isUserAreaSelectDisabled: context.state.isUserAreaSelectDisabled,
        isUserListingSelectDisabled: context.state.isUserListingSelectDisabled
    };
}

export async function getConversations(context, agentProfileUserId) {
    const workerURL = context.workerUrl;
    try {
        const response = await fetch(workerURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "getStates", agentProfileUserId: agentProfileUserId }),
        });

        if (response.ok) {
            const states = await response.json();
            const modifiedStates = states.map(({ id, name }) => ({ id, name }));
            return { modifiedStates, states };
        } else {
            throw new Error("Failed to get state from Cloudflare Worker");
        }
    } catch (error) {
        console.error("No states:", error);
        return { modifiedStates: [], states: [] };
    }
};

export async function storeConversations(context, agentProfileUserId, conversations) {
    const workerURL = context.workerUrl;
    const { privateMode } = context.state;

    if (Boolean(privateMode) === true) {
        return;
    }

    try {
        const response = await fetch(workerURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "storeStates", agentProfileUserId: agentProfileUserId, states: conversations }),
        });

        if (!response.ok) {
            throw new Error("Failed to store state in Cloudflare Worker");
        }
    } catch (error) {
        console.error("Error storing state:", error);
    }
};

export async function createConversation(context, conversationName) {
    const { agentProfileUserId, conversations, conversationsList } = context.state;
    const conversationCreated = Math.floor(Date.now() / 1000);

    const conversationSearch = conversationsList.find((conversation) => conversation.name === conversationName);

    if (conversationSearch && conversationName !== '') {
        context.setState({ currentConversation: conversationSearch.id });
        return fetchConversation(context, conversationSearch.id);
    }

    const simplifiedState = getSimplifiedState(context);

    const newConversation = {
        id: uuidv4(),
        name: conversationName,
        createdOn: conversationCreated,
        lastUpdated: conversationCreated,
        state: simplifiedState
    }

    const updatedConversations = [...conversations, newConversation];
    const updatedConversationList = [...conversationsList, { id: newConversation.id, name: newConversation.name }]

    await storeConversations(context, agentProfileUserId, updatedConversations);

    await context.setStateAsync({
        currentConversation: newConversation.id,
        conversations: updatedConversations,
        conversationsList: updatedConversationList
    });
}

export async function updateConversation(context) {
    const { currentConversation, conversations, agentProfileUserId, userMessage } = context.state;

    const simplifiedState = getSimplifiedState(context);

    const conversation = conversations.find((conversation) => conversation.id === currentConversation);

    if (conversation && currentConversation !== '') {
        conversation.state = simplifiedState;

        // Update the existing conversation in the array using the map function
        const updatedConversations = conversations.map((c) =>
            c.id === conversation.id ? { ...c, state: simplifiedState, lastUpdated: Math.floor(Date.now() / 1000) } : c
        );

        await storeConversations(context, agentProfileUserId, updatedConversations);
        await context.setStateAsync({
            conversations: updatedConversations
        });
    } else {
        await createConversation(context, userMessage.messageInput.slice(0, 30));
    }
}

export async function fetchConversation(context, conversationId) {
    const { agentProfileUserId } = context.state;

    const { states } = await getConversations(context, agentProfileUserId); // eslint-disable-line no-unused-vars

    const conversation = states.find((conversationState) => conversationState.id === conversationId);
    if (conversation) {
        const { state } = conversation;
        context.messageManager.messages = state.messages;
        await context.setStateAsync({
            messages: context.messageManager.messages,
            displayMessages: state.displayMessages,
            context_id: state.context_id,
            agentProfileUserId: state.agentProfileUserId,
            gptModel: state.gptModel,
            selectedListingMlsID: state.selectedListingMlsID,
            selectedListingMlsNumber: state.selectedListingMlsNumber,
            selectedListingAreaId: state.selectedListingAreaId,
            selectedAreaName: state.selectedAreaName,
            selectedAreaId: state.selectedAreaId,
            selectedListingAddress: state.selectedListingAddress,
            selectedProperty: state.selectedProperty,
            foundProperties: state.foundProperties,
            listingAreas: state.listingAreas,
            deletedMsgs: state.deletedMsgs,
            currentConversation: state.currentConversation,
            isAddressSearchDisabled: state.isAddressSearchDisabled,
            isUserAreaSelectDisabled: state.isUserAreaSelectDisabled,
            isUserListingSelectDisabled: state.isUserListingSelectDisabled,
        });
    }
}
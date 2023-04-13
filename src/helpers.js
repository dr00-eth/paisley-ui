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
import StartItems from "./startItems"
import ChatGPTBox from './chatGptBox';
import { updateConversation } from './conversation-utils/updateConversation';
import { createConversation } from './conversation-utils/createConversation';
import { fetchConversation } from './conversation-utils/fetchConversation';

export function showLoading(context) {
    context.setState({ isLoading: true });
}

export function hideLoading(context) {
    context.setState({ isLoading: false });
}

export function scrollToBottom(context) {
    const chatDisplay = context.chatDisplayRef.current;
  
    if (chatDisplay) {
      const scrollHeight = chatDisplay.scrollHeight;
      const scrollTop = chatDisplay.scrollTop;
      const clientHeight = chatDisplay.clientHeight;
      const threshold = 105;
  
      const prevMessagesCount = context.prevMessagesCount || 0;
      const currentMessagesCount = context.state.displayMessages.length;
  
      // Check if the user is already at the bottom of the chat display
      const isNearBottom = scrollHeight - scrollTop - clientHeight <= threshold;
  
      // Check if the number of messages has increased
      const isNewMessage = currentMessagesCount > prevMessagesCount;
  
      if (isNearBottom || isNewMessage) {
        chatDisplay.scrollTop = scrollHeight;
      }
  
      // Update the previous messages count
      context.prevMessagesCount = currentMessagesCount;
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
    await updateConversation(context);
    const newUserMessage = { ...userMessage, messageInput: "", vibedMessage: "" };
    try {
        await context.setStateAsync({
            messages: context.messageManager.resetMessages(),
            userMessage: newUserMessage,
            displayMessages: [],
            isUserListingSelectDisabled: false,
            selectedListingMlsID: '',
            selectedListingMlsNumber: '',
            selectedListingAddress: '',
            selectedAreaId: 0,
            selectedAreaName: '',
            selectedListingAreaId: 0,
            listingAreas: [],
            selectedProperty: [],
            addressSearchString: '',
            foundProperties: [],
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
            await updateConversation(context);
        }
        hideLoading(context);
    } catch (error) {
        console.error(error);
        hideLoading(context);
    }
}

export async function changeContext(context, event) {
    const { connection_id, userMessage } = context.state;
    const newContextId = parseInt(event.target.value);
    await context.setStateAsync({ 
        context_id: newContextId, 
        messages: context.messageManager.resetMessages(), 
        displayMessages: [], 
        currentConversation: '', 
        selectedAreaId: 0, 
        selectedListingAreaId: 0, 
        listingAreas: [], 
        selectedListingMlsID: '', 
        selectedListingMlsNumber: '', 
        selectedProperty: [],
        foundProperties: [],
        addressSearchString: '' });
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
            if (newContextId === 2 || newContextId === 3 || newContextId === 4) {
                const newUserMessage = { ...userMessage, tone: '', writingStyle: '', targetAudience: '', format: '', language: '' };
                await context.setStateAsync({ userMessage: newUserMessage, isSwapVibeCollapsed: true });
            }
            if (newContextId === 5) {
                await context.setStateAsync({ selectedListingAreaId: 0 })
            }
        })
        .catch(error => console.error(error));
}

export function handleMessage(context, data) {
    const { message } = data;

    if (message.trim() === '[START_OF_STREAM]') {
        clearTimeout(context.alertTimeout);
        context.setState(prevState => {
            const displayMessages = [...prevState.displayMessages];
            displayMessages.push({ role: "assistant", content: '', isFav: false });
            return { displayMessages, isWaitingForMessages: false };
        });
    } else {
        context.setState(prevState => {
            const displayMessages = [...prevState.displayMessages];
            const latestDisplayMsg = displayMessages[displayMessages.length - 1];
            latestDisplayMsg.content += message;
            return { displayMessages };
        });
    }
}

export function userSelectedListing(context) {
    return async (event) => {
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
        await createConversation(context, `${listingAddress}`);
        generateListingKit(context);

        hideLoading(context);
    };
}


export function userSelectedArea(context) {
    return async (event) => {
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
        await createConversation(context, `${areaName}`);
        generateAreaKit(context);

        hideLoading(context);
    };
}

export function userSelectedListingArea(context) {
    return async (event) => {
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
    };
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
        const newUserMessage = { ...userMessage, messageInput: enhancedMessage, isEnhanced: true };
        context.textareaRef.current.value = enhancedMessage;
        await context.setStateAsync({ userMessage: newUserMessage });
        hideLoading(context);
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

export function toggleSidebarCollapse(context, e) {
    e.preventDefault();
    context.setState((prevState) => ({
        isMenuCollapsed: !prevState.isMenuCollapsed
    }));
}

export function createVibeDropdown(options, currentValue, onChangeHandler, id) {
    return (
        <select className='Content-dropdown vibe' value={currentValue} onChange={onChangeHandler} id={id}>
            <option value="">--Select {id.replace(/-/g, ' ')}--</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

export function handleVibeDropdownChange(context, e, property) {
    e.preventDefault();
    const newUserMessage = { ...context.state.userMessage, [property]: e.target.value, messageInput: 'rewrite with these changes' };
    context.setState({ userMessage: newUserMessage });
}

export function formatKey(str) {
    return str
        .replace('plus', '+')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export function createButtons(context, menuItems) {
    const MySwal = withReactContent(Swal);
    const showWarning = (title, text) => {
        MySwal.fire({
            title,
            text,
            icon: 'warning',
            confirmButtonText: 'OK'
        });
    };

    const isInvalidSelection = (context) => {
        const { context_id, selectedListingMlsNumber, selectedAreaId, selectedProperty, incomingChatInProgress, isLoading } = context.state;

        return incomingChatInProgress || isLoading ||
            (context_id === 0 && selectedListingMlsNumber === '') ||
            (context_id === 1 && selectedAreaId === 0) ||
            (context_id === 5 && selectedProperty.length === 0);
    };

    const isButtonDisabled = (context) => {
        const { incomingChatInProgress } = context.state;
        return isInvalidSelection(context) || incomingChatInProgress;
    };

    const handleButtonClick = async (context, option) => {
        const { context_id, listings, areas, incomingChatInProgress, userMessage } = context.state;
        if (isInvalidSelection(context)) {
            
            const warningTitle = 'Quick Actions';
            if (incomingChatInProgress) {
                const text = 'Please wait until the current message is complete before selecting a new action.';
                showWarning(warningTitle, text);
            }
            else if (context_id === 0) {
                const text = listings.length > 0
                    ? 'Please select a Listing from the dropdown to use Quick Actions!'
                    : 'We could not find any listings associated with you. If this is incorrect, please live chat us!';
                showWarning(warningTitle, text);
            } else if (context_id === 1) {
                const text = areas.length > 0
                    ? 'Please select an Area from the dropdown to use Quick Actions!'
                    : 'We could not find any areas in your account. Please add areas in TheGenie Agent Dashboard or contact your title partner!';
                showWarning(warningTitle, text);
            } else {
                const itemType = context_id === 0 ? 'Listing' : (context_id === 1 ? 'Area' : 'Property');
                showWarning(warningTitle, `Please select a ${itemType} from the dropdown to use Quick Actions!`);
            }
        } else {
            const newUserMessage = { ...userMessage, messageInput: option.value };
            await context.setStateAsync({ userMessage: newUserMessage });
            const userMessagePrompt = option.customPrompt;
            const assistantMessage = `When you say "${option.value}" I will produce a response following this definition`;

            if (!messageExists(context, "user", userMessagePrompt)) {
                await addMessage(context, "user", userMessagePrompt, true);
            }

            if (!messageExists(context, "assistant", assistantMessage)) {
                await addMessage(context, "assistant", assistantMessage, true);
            }

            await sendMessage(context);
        }
    };

    return menuItems.map((option, index) => {
        return (
            <button
                key={index}
                className={isButtonDisabled(context) ? 'disabled' : ''}
                value={option.value}
                onClick={() => handleButtonClick(context, option)}>
                {option.label}
            </button>
        );
    });
}

// helpers.js
export function startMessagev2(context_id, appContext, handleClick) {
    return (
        <div className='start-container'>
            <div className='title-container'>
                <h2>Ask Paisley - <i>Your ultimate real estate productivity booster and colleague!</i></h2>
            </div>
            <div className='box-container'>
            <StartItems
                context_id={context_id}
                context={appContext}
                onClick={handleClick}
                listingChange={userSelectedListing(appContext)}
                listingAreaChange={userSelectedListingArea(appContext)}
                areaChange={userSelectedArea(appContext)}
            />

            </div>
            <p>-- Additional (Non-Real Estate) --</p>
            <div className='gpt-container'>
                <ChatGPTBox active={context_id === 4} onClick={handleClick} />
            </div>
        </div>
    )
};



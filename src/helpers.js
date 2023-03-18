import { generateListingKit, generateAreaKit } from "./utils";

export function updateDisplayMessagesWithFavorites(context) {
    const { displayMessages, messages } = context.state;
    const updatedDisplayMessages = displayMessages.map(msg => {
        const updatedMessage = messages.find(m => m.id === msg.id);
        return updatedMessage ? updatedMessage : msg;
    });
    context.setState({ displayMessages: updatedDisplayMessages });
}

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

// helpers.js
export function autoGrowTextarea(textareaRef) {
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

export async function waitForIncomingChatToFinish(context) {
    const { incomingChatInProgress } = context.state;
    while (incomingChatInProgress) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

export function assignMessageIdToDisplayMessage(context, content, messageId) {
    const updatedDisplayMessages = context.state.displayMessages.map(msg => {
        if (msg.content === content) {
            return { ...msg, id: messageId };
        }
        return msg;
    });
    context.setState({ displayMessages: updatedDisplayMessages });
}

export function handleToggleFavorite(context, id) {
    context.messageManager.toggleFavorite(id);
    context.setState({ messages: context.messageManager.getMessages() }, () => {
        updateDisplayMessagesWithFavorites(context);
    });
    console.log(context.messageManager.messages);
}

export function messageExists(context, role, content) {
    const messages = context.messageManager.getMessages();
    return messages.some(message => message.role === role && message.content === content);
}

export async function resetChat(context, event) {
    event.preventDefault();
    showLoading(context);
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: context.state.connection_id, context_id: context.state.context_id }),
    };
    try {
        const response = await fetch(`${context.apiServerUrl}/api/newchat`, requestOptions);
        if (!response.ok) {
            hideLoading(context);
            throw new Error('Failed to reset chat');
        }
        await fetch(`${context.apiServerUrl}/api/getmessages/${context.state.context_id}/${context.state.connection_id}`);

        context.setState({
            messages: context.messageManager.resetMessages(),
            displayMessages: [],
            isUserListingSelectDisabled: false,
            selectedListingMlsID: '',
            selectedListingMlsNumber: '',
        });
        await context.getAgentProfile();
        context.listingSelectRef.current.value = '';
        context.areaSelectRef.current.value = '';
        hideLoading(context);
    } catch (error) {
        hideLoading(context);
        console.error(error);
    }
}

export function changeContext(context, event) {
    const { connection_id } = context.state;
    const newContextId = parseInt(event.target.value);
    context.setState({ context_id: newContextId, messages: context.messageManager.resetMessages(), displayMessages: [] });
    fetch(`${context.apiServerUrl}/api/getmessages/${newContextId}/${connection_id}`)
        .then(response => response.json())
        .then(() => {
            if (newContextId === 2 || newContextId === 3) {
                context.getAgentProfile();
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
        // Add a new assistant message with the incoming message
        displayMessages.push({ role: "assistant", content: data.message, isFav: false });
    }
    context.setState({ displayMessages: displayMessages });
}

export async function userSelectedListing(context, event) {
    event.preventDefault();
    const [mlsID, mlsNumber] = event.target.value.split('_');
    context.setState({
      selectedListingMlsID: mlsID,
      selectedListingMlsNumber: mlsNumber
    });
    showLoading(context);
    await context.getPropertyProfile(mlsID, mlsNumber, context.state.selectedListingMlsNumber ? true : false);
    hideLoading(context);
    generateListingKit(context);
  }

export async function userSelectedArea(context, event) {
    event.preventDefault();
    const areaId = event.target.value;
    context.setState({
        selectedAreaId: areaId
    });
    showLoading(context);
    await this.getAreaStatisticsPrompt(areaId, context.state.selectedAreaId ? true : false);
    hideLoading(context);
    generateAreaKit(context);
  }

export async function userSelectedListingArea(context, event) {
    event.preventDefault();
    const selectedListingAreaId = event.target.value;
    context.setState({
        selectedListingAreaId
      });
    showLoading(context);
    await context.getAreaStatisticsPrompt(selectedListingAreaId, context.state.selectedListingAreaId ? true : false);
    hideLoading(context);
    context.generateAreaKit();
  }
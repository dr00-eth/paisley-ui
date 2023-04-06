import { getSimplifiedState } from "./getSimplifiedState";
import { storeKv } from "../kv.utils";
import { createConversation } from "./createConversation";


export async function updateConversation(context) {
    const { currentConversation, conversations, agentProfileUserId, userMessage } = context.state;

    if (currentConversation === '') {
        return;
    }

    const simplifiedState = getSimplifiedState(context);

    const conversation = conversations.find((conversation) => conversation.id === currentConversation);

    if (conversation && currentConversation !== '') {
        conversation.state = simplifiedState;

        // Update the existing conversation in the array using the map function
        const updatedConversations = conversations.map((c) => c.id === conversation.id ? { ...c, state: simplifiedState, lastUpdated: Math.floor(Date.now() / 1000) } : c
        );

        await storeKv(context, agentProfileUserId, updatedConversations);
        await context.setStateAsync({
            conversations: updatedConversations
        });
    } else {
        await createConversation(context, userMessage.messageInput.slice(0, 30));
    }
}

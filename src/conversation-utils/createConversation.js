import { v4 as uuidv4 } from 'uuid';
import { getSimplifiedState } from "./getSimplifiedState";
import { fetchConversation } from "./fetchConversation";
import { storeKv } from "../kv.utils";


export async function createConversation(context, conversationName) {
    const { agentProfileUserId, conversations, conversationsList, context_id } = context.state;
    const conversationCreated = Math.floor(Date.now() / 1000);

    const conversationSearch = conversationsList.find((conversation) => conversation.name === conversationName);

    if (conversationSearch && conversationName !== '' && (context_id === 0 || context_id === 1 || context_id === 5)) {
        await context.setStateAsync({ currentConversation: conversationSearch.id });
        return fetchConversation(context, conversationSearch.id);
    }

    const conversationStub = {
        id: uuidv4(),
        name: conversationName,
        createdOn: conversationCreated,
        lastUpdated: conversationCreated
    };

    const simplifiedState = getSimplifiedState(context);

    const stateWithId = { ...simplifiedState, currentConversation: conversationStub.id };

    const newConversation = { ...conversationStub, state: stateWithId };

    const updatedConversations = [...conversations, newConversation];
    const updatedConversationList = [...conversationsList, { id: newConversation.id, name: newConversation.name }];

    await context.setStateAsync({
        currentConversation: newConversation.id,
        conversations: updatedConversations,
        conversationsList: updatedConversationList
    });

    await storeKv(context, agentProfileUserId, updatedConversations);

}

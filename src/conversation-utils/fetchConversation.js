import { getKv } from '../kv.utils';


export async function fetchConversation(context, conversationId) {
    const { agentProfileUserId } = context.state;

    const states = await getKv(context, agentProfileUserId); // eslint-disable-line no-unused-vars
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
            addressSearchString: state.addressSearchString ?? '',
            listingAreas: state.listingAreas,
            deletedMsgs: state.deletedMsgs,
            currentConversation: state.currentConversation === "" ? conversation.id : state.currentConversation,
            isAddressSearchDisabled: state.isAddressSearchDisabled,
            isUserAreaSelectDisabled: state.isUserAreaSelectDisabled,
            isUserListingSelectDisabled: state.isUserListingSelectDisabled,
        });
    }
}

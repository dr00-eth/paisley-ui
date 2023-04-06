
export function getSimplifiedState(context) {
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
        addressSearchString: context.state.addressSearchString,
        listingAreas: context.state.listingAreas,
        deletedMsgs: context.state.deletedMsgs,
        currentConversation: context.state.currentConversation,
        isAddressSearchDisabled: context.state.isAddressSearchDisabled,
        isUserAreaSelectDisabled: context.state.isUserAreaSelectDisabled,
        isUserListingSelectDisabled: context.state.isUserListingSelectDisabled
    };
}

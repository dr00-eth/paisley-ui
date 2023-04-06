import { getKv } from '../kv.utils';


export async function fetchConversationList(context) {
    const { agentProfileUserId } = context.state;

    const states = await getKv(context, agentProfileUserId);
    const modifiedStates = states.map(({ id, name }) => ({ id, name }));
    return modifiedStates;
}

export function extractGraph(agentState: any) {
  return {
    state_graph: agentState?.knowledge?.state_graph ?? {},
    action_api_map: agentState?.knowledge?.action_api_map ?? {}
  };
}

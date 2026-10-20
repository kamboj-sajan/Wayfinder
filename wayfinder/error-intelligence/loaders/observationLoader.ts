export function extractObservation(agentState: any) {
  return agentState?.observation ?? {};
}

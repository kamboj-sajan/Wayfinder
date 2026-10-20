export function extractAnomalies(agentState: any) {
  return agentState?.anomalies ?? [];
}

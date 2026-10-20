export async function analyzePerformance(networkCalls: any[] = []) {
  return networkCalls.map(call => ({
    url: call.url,
    method: call.method,
    response_time_ms: call.response_time_ms,
    baseline_delta: null,
    status: "PENDING_MONITOR_CORRELATION"
  }));
}

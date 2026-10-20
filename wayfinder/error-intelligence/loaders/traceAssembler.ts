export function assembleRunTrace(run: any) {
  const trace = [];

  for (const step of run.steps) {
    const obs = step.data;

    trace.push({
      action_id: obs.action_id ?? "(unknown)",
      network_calls: obs.network_calls ?? [],
      screenshots: obs.screenshots ?? [],
      state_delta: obs.state_delta ?? {},
      console_errors: obs.console_errors ?? [],
      source_file: step.file
    });
  }

  return trace;
}

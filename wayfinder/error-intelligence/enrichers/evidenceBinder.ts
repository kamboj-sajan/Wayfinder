/**
 * Binds screenshots + traces as evidence to anomalies
 * without mutating source data.
 */
export function bindAnomalyEvidence(report: any) {
  const anomalies = report.anomalies ?? [];
  const steps = report.traces ?? [];

  return anomalies.map((a: any) => {
    const relatedSteps = steps.filter(
      (s: any) => s.action_id === a.action_id
    );

    const screenshots = relatedSteps.flatMap(
      (s: any) => s.screenshots ?? []
    );

    const network = relatedSteps.flatMap(
      (s: any) => s.network_calls ?? []
    );

    return {
      ...a,
      evidence_links: {
        screenshots,
        network_calls: network
      }
    };
  });
}

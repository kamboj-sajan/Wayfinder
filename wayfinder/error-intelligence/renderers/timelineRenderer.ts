function pad(s: string, n: number) {
  return (s ?? "").padEnd(n, " ");
}

export function renderActionTimeline(report: any) {
  const steps = report.traces ?? [];
  const anomalies = report.anomalies ?? [];

  console.log("\nExecution Timeline");
  console.log("──────────────────");

  if (!steps.length) {
    console.log("  (no execution trace available)");
    return;
  }

  steps.forEach((step: any, idx: number) => {
    const action = step.action_id ?? "(unknown action)";

    // ----- MATCH ANOMALIES TO THIS ACTION -----
    const stepAnomalies = anomalies.filter(
      (a: any) => a.action_id === action
    );

    const failMark = stepAnomalies.length ? " ❌" : "";
    console.log(`\n[${idx + 1}] ${action}${failMark}`);

    // ----- PRINT ANOMALIES INLINE -----
if (stepAnomalies.length) {
  stepAnomalies.forEach((a: any) => {
    console.log(`   ⚠ ${a.severity} :: ${a.category}`);
    if (a.description) console.log(`   → ${a.description}`);

    // Evidence links (screenshots + APIs)
    if (a.evidence_links?.screenshots?.length) {
      a.evidence_links.screenshots.forEach((sc: any) => {
        console.log(`   evidence screenshot: ${sc.path}`);
      });
    }

    if (a.evidence_links?.network_calls?.length) {
      a.evidence_links.network_calls.forEach((nc: any) => {
        console.log(
          `   evidence api: ${nc.method} ${nc.url} (${nc.status ?? "?"})`
        );
      });
    }
  });
}

    

    // ----- NETWORK CALLS -----
    if (!step.network_calls?.length) {
      console.log("   • no network calls");
    } else {
      step.network_calls.forEach((nc: any) => {
        console.log(
          `   • ${pad(nc.method, 6)} ${pad(nc.url, 30)} → ${nc.status ?? ""} (${nc.response_time_ms ?? "?"}ms)`
        );
      });
    }

    // ----- SCREENSHOTS -----
    if (!step.screenshots?.length) {
      console.log("   • no screenshots");
    } else {
      step.screenshots.forEach((sc: any) => {
        console.log(`   • screenshot: ${sc.path}`);
      });
    }

    // ----- STATE DELTA -----
    if (step.state_delta && Object.keys(step.state_delta).length > 0) {
      console.log("   • state_delta:", JSON.stringify(step.state_delta));
    }
  });

  console.log();
}

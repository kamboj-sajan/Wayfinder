export async function diagnoserNode(state: any) {

  const anomalies = state.anomalies || [];

  if (!anomalies.length) {
    return state;
  }

  // Pick most relevant anomaly
  const main = anomalies[0];

  const raw =
    main.message ||
    main.error ||
    JSON.stringify(main);

  const signature = normalize(raw);

  let rootCause = "unknown";

  if (raw.includes("404")) {
    rootCause = "missing backend route";
  } else if (raw.includes("500")) {
    rootCause = "server crash";
  } else if (raw.includes("timeout")) {
    rootCause = "network latency";
  } else if (raw.toLowerCase().includes("cors")) {
    rootCause = "cors misconfiguration";
  }

  console.log("🩺 Diagnoser");
  console.log("Raw:", raw);
  console.log("Signature:", signature);
  console.log("Root cause:", rootCause);

  return {
    ...state,
    diagnosis: {
      raw_error: raw,
      error_signature: signature,
      root_cause: rootCause
    }
  };
}

/* ---------- helpers ---------- */

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\d+/g, "N")
    .replace(/\/[a-zA-Z0-9-_]+/g, "/:param")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function runContentSafetyOnScreenshots(observation: any) {
  const screenshots = observation?.screenshots ?? [];

  return screenshots.map((shot: any) => ({
    screenshot: shot?.path ?? "unknown",
    status: "PENDING_ANALYSIS",
    risk_level: "UNKNOWN",
    flags: []
  }));
}

export async function persistArtifacts(_runId: string, _observation: any) {
  return {
    storage_refs: [],
    status: "PENDING_STORAGE_BINDING"
  };
}

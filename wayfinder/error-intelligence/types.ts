export type AgentState = {
  run_id: string;

  ui_state: any;
  observation: any;

  knowledge: {
    state_graph: any;
    action_api_map: any;
  };

  anomalies?: any[];
};

export type ReportEnvelope = {
  run_id: string;

  graph_summary: any;
  anomalies: any[];

  traces: any[];

  enrichment: {
    content_safety: any[];
    performance: any[];
  };

  storage_refs: any[];
};

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Enable TS + ESM loader safely
register("ts-node/esm", pathToFileURL("./"));

const { runPrompt4Pipeline } = await import("./pipeline.ts");

// Read args
const [, , agentStatePath, outPath] = process.argv;

if (!agentStatePath || !outPath) {
  console.error("Usage: node run-pipeline.mjs <agent_state.json> <output.json>");
  process.exit(1);
}

await runPrompt4Pipeline(agentStatePath, outPath);

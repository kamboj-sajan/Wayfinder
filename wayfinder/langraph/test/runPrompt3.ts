const fs = require("fs");
const path = require("path");
const { runPrompt3 } = require("../index");

async function main() {
  const statePath = path.resolve(__dirname, "../../test/agentState.mock.json");
  const agentState = JSON.parse(
    fs.readFileSync(statePath, "utf-8")
  );

  const result = await runPrompt3(agentState);

  console.log("\n=== PROMPT-3 OUTPUT ===\n");

  console.log("Decision:");
  console.dir(result.decision, { depth: null });

  console.log("\nAnomalies:");
  console.dir(result.anomalies, { depth: null });
}

main().catch(err => {
  console.error("Prompt-3 execution failed:");
  console.error(err);
  process.exit(1);
});

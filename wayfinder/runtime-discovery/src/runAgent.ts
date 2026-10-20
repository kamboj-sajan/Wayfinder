import { discoverUI, executeAction, initializeBrowser, closeBrowser, takeScreenshot } from "./agentRuntime.js";
import { runAgentTurn } from "../../langraph/index.js";
import { graphTracker } from "../../langraph/graph-tracker.js";
import { AgentState, ActionContract } from "./types.js";
import { validateUrl } from "./urlValidator.js";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load runtime-discovery/.env relative to this file, not the working
// directory: the VS Code extension starts the agent from runtime-discovery/,
// where a cwd-relative path missed the file and runs went unsaved.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const API_BASE_URL = process.env.WAYFINDER_API_URL || "http://localhost:5050";
const API_KEY = process.env.WAYFINDER_API_KEY || process.env.API_KEY;

if (!API_KEY) {
  console.warn(
    "⚠️ WAYFINDER_API_KEY is not set - run persistence to the backend will be rejected with 401."
  );
}

const cosmosApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "x-api-key": API_KEY ?? ""
  }
});

const insertTestRun = async (data: any) => {
  try {
    return await cosmosApi.post("/db/test-runs", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert test run:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const insertTestStep = async (data: any) => {
  try {
    return await cosmosApi.post("/db/test-steps", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert test step:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

// Hand the screenshot to the backend so the dashboard can show it when the
// agent and the backend run on different machines.
const uploadScreenshot = async (screenshotPath: string) => {
  if (!screenshotPath) return;
  try {
    const filename = encodeURIComponent(path.basename(screenshotPath));
    await cosmosApi.put(`/graph/screenshots/${filename}`, fs.readFileSync(screenshotPath), {
      headers: { "Content-Type": "image/png" }
    });
  } catch (err) {
    console.warn("⚠️ Failed to upload screenshot:", err instanceof Error ? err.message : String(err));
  }
};

const insertAnomaly = async (data: any) => {
  try {
    return await cosmosApi.post("/db/anomalies", data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to insert anomaly:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const updateTestRun = async (runId: string, data: any) => {
  try {
    return await cosmosApi.put(`/db/test-runs/${runId}`, data);
  } catch (err) {
    console.warn("⚠️ CosmosDB: Failed to update test run:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

const args = process.argv.slice(2);
const headfulIndex = args.indexOf('--headful');
const headless = headfulIndex === -1;

if (headfulIndex !== -1) {
  args.splice(headfulIndex, 1);
}

const rawUrl = args[0];

if (!rawUrl) {
  console.error("Usage: npm run start <url> or npm run start-headful <url>");
  process.exit(1);
}

let targetUrl: string;

try {
  targetUrl = validateUrl(rawUrl);
} catch (error) {
  console.error("❌ Invalid URL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/** Minimum decision confidence required before an action is executed. */
const MIN_EXECUTION_CONFIDENCE = 0.4;

/** Hard cap on turns for a single run. */
const MAX_STEPS = 100;

function createRuntimeExecutor() {
  return async (action_id: string, parameters: Record<string, any>): Promise<void> => {
    const action: ActionContract = { action_id, parameters };
    await executeAction(action);
  };
}

async function main() {
  const graphRunId = `run-${Date.now()}`;
  let stepIndex = 0;
  let successfulSteps = 0;
  let failedSteps = 0;
  let anomaliesCount = 0;

  // Every exit path (normal end, Ctrl+C, startup failure, crash) must close the
  // run record, otherwise the dashboard shows it as "running" forever.
  let finalStatus: "completed" | "failed" | "stopped" = "completed";
  // Callers share one in-flight update, so a caller that exits right after
  // awaiting it cannot cut off a write another caller started.
  let finalizing: Promise<unknown> | null = null;
  const finalizeRun = () => {
    finalizing ??= updateTestRun(graphRunId, {
      status: finalStatus,
      completedAt: new Date().toISOString(),
      totalSteps: stepIndex,
      successfulSteps,
      failedSteps,
      anomaliesCount
    });
    return finalizing;
  };

  // First Ctrl+C stops after the current step; a second one records the run
  // and exits immediately. npm forwards the signal on top of the terminal
  // delivering it, so one keypress arrives twice within milliseconds - the
  // repeat is ignored. Run via `node --import tsx`, not the tsx CLI, whose
  // signal relay can SIGKILL the agent before it records the run.
  let stopRequestedAt = 0;
  const onSignal = async () => {
    finalStatus = "stopped";
    process.exitCode = 130;
    if (stopRequestedAt) {
      if (Date.now() - stopRequestedAt < 1000) return;
      await finalizeRun();
      process.exit(130);
    }
    stopRequestedAt = Date.now();
    console.log("\n🛑 Stopping after the current step (Ctrl+C again to quit now)...");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    const state: AgentState = {
      schema_version: "1.0",
      run_id: graphRunId,
      runtime: {
        url: targetUrl,
        browser: "chromium",
        timestamp: new Date().toISOString(),
        execute: createRuntimeExecutor()
      },
      steps: []
    };

    // One traversal graph per run. Previously this was started inside the agent
    // graph, which produced a fresh single-node graph on every turn.
    graphTracker.startRun(graphRunId);

    await insertTestRun({
      runId: graphRunId,
      targetUrl,
      startedAt: new Date().toISOString(),
      status: "running",
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      anomaliesCount: 0
    });

    // Return rather than process.exit() so `finally` still closes the run.
    try {
      await initializeBrowser(headless);
    } catch (error) {
      console.error("❌ Failed to initialize browser:", error instanceof Error ? error.message : String(error));
      finalStatus = "failed";
      process.exitCode = 1;
      return;
    }

    try {
      state.ui_state = await discoverUI(targetUrl, headless);
    } catch (error) {
      console.error("❌ Initial UI discovery failed:", error instanceof Error ? error.message : String(error));
      finalStatus = "failed";
      process.exitCode = 1;
      return;
    }

    let consecutiveFailures = 0;
    let noActionSteps = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    const MAX_NO_ACTION_STEPS = 3;

    for (let step = 0; step < MAX_STEPS; step++) {
      try {
        if (stopRequestedAt) {
          console.log("🛑 Stopped by user");
          break;
        }

        if (state.ui_state?.route === '/error' && step > 5) {
          console.log("🛑 Stuck in error route - terminating");
          break;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`🛑 Too many consecutive failures (${consecutiveFailures}) - terminating`);
          break;
        }

        if (noActionSteps >= MAX_NO_ACTION_STEPS) {
          console.log(`🛑 No available actions for ${noActionSteps} steps - terminating`);
          break;
        }

        console.log(`\n[Loop] Step ${step + 1}`);

        // Capture state ID BEFORE execution to attribute the action correctly
        const preExecutionStateId = state.ui_state?.state_id;

        // Capture screenshot for graph tracking
        try {
          const screenshotPath = await takeScreenshot(`state_${preExecutionStateId}`);
          state.screenshot_url = screenshotPath;
        } catch (err) {
          console.warn("⚠️ Failed to capture state screenshot:", err);
        }

        try {
          const updatedState = await runAgentTurn(state);

          // Carry the full agent output forward. Copying only next_action
          // dropped the anomalies and control signal, so critical failures
          // never stopped the run and no anomaly was ever persisted.
          state.next_action = updatedState.next_action ?? null;
          state.anomalies = updatedState.anomalies ?? [];
          state.diagnosis = updatedState.diagnosis;
          state.validation = updatedState.validation;
          state.reasoning = updatedState.reasoning || updatedState.decision?.reasoning;

          if (updatedState.decision) state.decision = updatedState.decision;
          if (updatedState.knowledge_context) {
            state.knowledge_context = updatedState.knowledge_context;
          }
          if (updatedState.control) state.control = updatedState.control;
        } catch (error) {
          console.error("❌ Agent logic failed:", error instanceof Error ? error.message : String(error));
          state.reasoning = `Agent logic failed during decision phase: ${error instanceof Error ? error.message : String(error)}`;
          consecutiveFailures++;
        }

        console.log("[DEBUG] Next action:", state.next_action?.action_id);

        // Safety gate: refuse to act on a low-confidence decision. This lived in
        // an executor node that was imported but never called, so it never ran.
        const confidence = state.decision?.confidence;
        const lowConfidence =
          confidence !== undefined && confidence < MIN_EXECUTION_CONFIDENCE;

        if (lowConfidence && state.next_action) {
          console.log(
            `⚠️ Skipping ${state.next_action.action_id}: confidence ${confidence!.toFixed(2)} < ${MIN_EXECUTION_CONFIDENCE}`
          );
          state.next_action = null;
          state.reasoning = `Skipped: decision confidence ${confidence!.toFixed(2)} below the ${MIN_EXECUTION_CONFIDENCE} execution threshold.`;
        }

        if (!state.next_action || !state.ui_state?.available_actions?.length) {
          noActionSteps++;
        } else {
          noActionSteps = 0;
        }

        let observation;
        try {
          if (state.next_action) {
            observation = await executeAction(state.next_action);
          } else {
            const idleScreenshot = await takeScreenshot("idle");
            observation = {
              actionId: "no_action",
              networkCalls: [],
              consoleErrors: [],
              screenshotPath: idleScreenshot,
              skipped: true
            };
          }
        } catch (error) {
          console.error("❌ Action execution failed:", error instanceof Error ? error.message : String(error));
          consecutiveFailures++;
          const errorScreenshot = await takeScreenshot("error");
          observation = {
            actionId: state.next_action?.action_id || "unknown",
            networkCalls: [],
            consoleErrors: [error instanceof Error ? error.message : String(error)],
            screenshotPath: errorScreenshot,
            skipped: true
          };
        }

        try {
          state.ui_state = await discoverUI(targetUrl, headless);
          if (state.ui_state && state.ui_state.available_actions.length > 0) {
            consecutiveFailures = 0;
          }
        } catch (error) {
          console.warn("⚠️ UI refresh failed:", error instanceof Error ? error.message : String(error));
          consecutiveFailures++;
        }

        // Record what actually happened so the next turn's learner node can
        // attribute the outcome. Without this, learner always returned early.
        state.execution = state.next_action
          ? {
              action_id: state.next_action.action_id,
              parameters: state.next_action.parameters,
              timestamp: Date.now(),
              skipped: observation.skipped === true,
              ...(observation.skipped ? { reason: "ACTION_NOT_EXECUTED" } : {})
            }
          : { skipped: true, reason: "NO_ACTION", timestamp: Date.now() };

        if (!state.next_action) {
          // An idle turn is neither a success nor a failure.
        } else if (observation.skipped) {
          failedSteps++;
        } else {
          successfulSteps++;
        }
        anomaliesCount += state.anomalies?.length ?? 0;

        // Update internal state steps for memory-based decisions
        state.steps.push({
          step: stepIndex,
          action: state.next_action || { action_id: "none", parameters: {} },
          observation: observation,
          state_id: preExecutionStateId,
          anomalies: state.anomalies || []
        });

        await uploadScreenshot(observation.screenshotPath || "");

        await insertTestStep({
          runId: graphRunId,
          stepIndex: stepIndex++,
          actionId: state.next_action?.action_id || "unknown",
          actionType: state.next_action?.action_id?.split(":")[0] || (state.next_action ? "unknown" : "idle"),
          parameters: state.next_action?.parameters || {},
          timestamp: new Date().toISOString(),
          status: observation.skipped ? "failed" : "success",
          screenshotPath: observation.screenshotPath || "",
          networkCalls: observation.networkCalls.length,
          consoleErrors: observation.consoleErrors,
          stateId: preExecutionStateId, // Essential for branching
          reasoning: state.reasoning || (state.next_action ? "Executing planned action." : "No action determined by agent.")
        });

        if (state.anomalies && state.anomalies.length > 0) {
          for (const anomaly of state.anomalies) {
            await insertAnomaly({
              runId: graphRunId,
              stepIndex: stepIndex - 1,
              ...anomaly
            });
          }
        }
        if (state.control === "TERMINATE") {
          console.log(`🛑 Agent signalled TERMINATE: ${state.reasoning}`);
          break;
        }
      } catch (loopError) {
        console.error("❌ Step loop error:", loopError);
        consecutiveFailures++;
      }
    }

  } catch (error) {
    console.error("❌ Main execution failed:", error);
    finalStatus = "failed";
    process.exitCode = 1;
  } finally {
    await finalizeRun();
    // Persist the traversal graph exactly once, at the end of the run.
    graphTracker.finishRun();
    await closeBrowser();
    console.log(
      `\n${finalStatus === "completed" ? "✅" : "🛑"} Run ${finalStatus}. Run ID: ${graphRunId} | ${stepIndex} steps, ${successfulSteps} ok, ${failedSteps} failed, ${anomaliesCount} anomalies`
    );
  }
}

main();

import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function get(context) {
  const runId = String(context.query?.runId || "").trim();
  if (!runId) {
    const error = new Error("runId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).events(runId);
}

import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function post(context) {
  return getService(context).start(context.body || {});
}

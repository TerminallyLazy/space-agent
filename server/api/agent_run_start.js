import fs from "node:fs";

import { getSharedRunnerService } from "../lib/agent_runners/service.js";

const DEBUG_LOG = "/tmp/space-agent-runner-debug.log";

function debugLog(label, data) {
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${new Date().toISOString()} ${label}: ${JSON.stringify(data, null, 2)}\n`
    );
  } catch {}
}

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function post(context) {
  const body = context.body || {};
  debugLog("REQUEST", {
    graphId: body.graphId,
    nodeId: body.nodeId,
    provider: body.provider,
    hasCredential: Boolean(body.credential),
    credentialProvider: body.credential?.provider,
    credentialBaseURL: body.credential?.baseURL,
    credentialHasSecret: Boolean(body.credential?.secret),
    config: body.config,
    runtime: body.runtime
  });
  try {
    const result = await getService(context).start(body);
    debugLog("RESULT", { status: result.status, error: result.error, resultKeys: Object.keys(result || {}) });
    let safeResult;
    try {
      safeResult = JSON.parse(JSON.stringify(result));
    } catch (serializationError) {
      debugLog("SERIALIZE_FAILED", {
        message: serializationError?.message,
        stack: serializationError?.stack?.split("\n").slice(0, 6)
      });
      const wrapped = new Error(`Run completed but response not serializable: ${serializationError.message}`);
      wrapped.statusCode = 500;
      throw wrapped;
    }
    debugLog("SAFE_RESULT", safeResult);
    return { run: safeResult };
  } catch (error) {
    debugLog("THREW", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack?.split("\n").slice(0, 8)
    });
    const wrapped = new Error(error?.message || "agent_run_start failed.");
    wrapped.statusCode = Number(error?.statusCode) || 400;
    wrapped.cause = error;
    throw wrapped;
  }
}

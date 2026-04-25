import { runClaudeAgent } from "./claude.js";
import { runOpenAIAgent } from "./openai.js";
import { forwardA2ATask } from "./a2a.js";

const RUNS = new Map();
const EVENTS = new Map();

export function normalizeRunRequest(source = {}) {
  const provider = String(source.provider || "").trim();
  const credential = source.credential || null;
  if (!provider) {
    throw httpError("provider is required.", 400);
  }
  if (
    (provider === "openai" || provider === "anthropic") &&
    (!credential?.secret || credential.provider !== provider)
  ) {
    throw httpError(`Credential provider must match ${provider}.`, 400);
  }
  return {
    graphId: String(source.graphId || "").trim(),
    nodeId: String(source.nodeId || "").trim(),
    provider,
    input: String(source.input || ""),
    credential,
    node: source.node && typeof source.node === "object" ? source.node : { config: {} }
  };
}

export function redactRunRequest(source = {}) {
  return {
    ...source,
    credential: source.credential
      ? { provider: source.credential.provider, secret: "[redacted]" }
      : null
  };
}

export function createRunRecord(request) {
  return {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
    graphId: request.graphId,
    nodeId: request.nodeId,
    provider: request.provider,
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: ""
  };
}

export function createRunnerService({ adapters = defaultAdapters() } = {}) {
  return {
    async start(source) {
      const request = normalizeRunRequest(source);
      const run = createRunRecord(request);
      RUNS.set(run.id, run);
      EVENTS.set(run.id, []);
      try {
        const adapter = adapters[request.provider];
        if (!adapter) throw httpError(`Unsupported provider ${request.provider}.`, 400);
        for await (const event of adapter.run(request)) {
          EVENTS.get(run.id).push({
            ...event,
            runId: run.id,
            createdAt: new Date().toISOString()
          });
        }
        run.status = "completed";
      } catch (error) {
        run.status = "error";
        run.error = error.message || "Runner failed.";
      }
      run.updatedAt = new Date().toISOString();
      return run;
    },
    status(runId) {
      return RUNS.get(runId) || null;
    },
    stop(runId) {
      const run = RUNS.get(runId);
      if (run) {
        run.status = "stopped";
        run.updatedAt = new Date().toISOString();
      }
      return run || null;
    },
    events(runId) {
      return EVENTS.get(runId) || [];
    }
  };
}

export function getSharedRunnerService() {
  if (!globalThis.__spaceOrchestratorRunnerService) {
    globalThis.__spaceOrchestratorRunnerService = createRunnerService();
  }
  return globalThis.__spaceOrchestratorRunnerService;
}

function defaultAdapters() {
  return {
    anthropic: { run: runClaudeAgent },
    openai: { run: runOpenAIAgent },
    a2a: { run: forwardA2ATask }
  };
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

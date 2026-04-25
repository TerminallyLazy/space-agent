export function createRunnerClient(runtimeInput) {
  const runtime = ensureApiRuntime(runtimeInput);

  return {
    start(request = {}) {
      return runtime.api.call("agent_run_start", {
        method: "POST",
        body: normalizeObject(request)
      });
    },
    status(runId) {
      return runtime.api.call("agent_run_status", {
        query: { runId: normalizeId(runId) }
      });
    },
    stop(runId) {
      return runtime.api.call("agent_run_stop", {
        method: "POST",
        body: { runId: normalizeId(runId) }
      });
    },
    events(runId, query = {}) {
      return runtime.api.call("agent_run_events", {
        query: {
          ...normalizeObject(query),
          runId: normalizeId(runId)
        }
      });
    }
  };
}

function ensureApiRuntime(runtimeInput) {
  const runtime = runtimeInput || globalThis.space;
  if (!runtime?.api || typeof runtime.api.call !== "function") {
    throw new Error("Orchestrator runner client requires space.api.call.");
  }

  return runtime;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function normalizeId(value) {
  return String(value || "").trim();
}

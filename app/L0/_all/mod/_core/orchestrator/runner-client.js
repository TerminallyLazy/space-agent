export function createRunnerClient(runtimeInput) {
  const runtime = ensureApiRuntime(runtimeInput);

  return {
    async start(request = {}) {
      const response = await runtime.api.call("agent_run_start", {
        method: "POST",
        body: normalizeObject(request)
      });
      return unwrapRun(response);
    },
    async status(runId) {
      const response = await runtime.api.call("agent_run_status", {
        query: { runId: normalizeId(runId) }
      });
      return unwrapRun(response);
    },
    async stop(runId) {
      const response = await runtime.api.call("agent_run_stop", {
        method: "POST",
        body: { runId: normalizeId(runId) }
      });
      return unwrapRun(response);
    },
    async events(runId, query = {}) {
      const response = await runtime.api.call("agent_run_events", {
        query: {
          ...normalizeObject(query),
          runId: normalizeId(runId)
        }
      });
      if (response && Array.isArray(response.events)) return response.events;
      return Array.isArray(response) ? response : [];
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

function unwrapRun(response) {
  if (response && typeof response === "object" && response.run && typeof response.run === "object") {
    return response.run;
  }
  return response;
}

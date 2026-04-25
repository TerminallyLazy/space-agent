export function createDockerClient(runtimeInput) {
  const runtime = ensureApiRuntime(runtimeInput);

  return {
    list(query = {}) {
      return runtime.api.call("docker_list", { query: normalizeQuery(query) });
    },
    inspect(containerId) {
      return runtime.api.call("docker_inspect", { query: { containerId: normalizeId(containerId) } });
    },
    create(config = {}) {
      return mutation(runtime, "docker_create", config);
    },
    start(containerId) {
      return containerMutation(runtime, "docker_start", containerId);
    },
    stop(containerId) {
      return containerMutation(runtime, "docker_stop", containerId);
    },
    restart(containerId) {
      return containerMutation(runtime, "docker_restart", containerId);
    },
    remove(containerId) {
      return containerMutation(runtime, "docker_remove", containerId);
    },
    logs(containerId, query = {}) {
      return runtime.api.call("docker_logs", {
        query: {
          ...normalizeQuery(query),
          containerId: normalizeId(containerId)
        }
      });
    },
    exec(containerId, options = {}) {
      return mutation(runtime, "docker_exec", {
        ...normalizeBody(options),
        containerId: normalizeId(containerId)
      });
    },
    networkCreate(config = {}) {
      return mutation(runtime, "docker_network_create", config);
    },
    networkConnect(networkId, containerId, options = {}) {
      return mutation(runtime, "docker_network_connect", {
        ...normalizeBody(options),
        networkId: normalizeId(networkId),
        containerId: normalizeId(containerId)
      });
    },
    networkDisconnect(networkId, containerId, options = {}) {
      return mutation(runtime, "docker_network_disconnect", {
        ...normalizeBody(options),
        networkId: normalizeId(networkId),
        containerId: normalizeId(containerId)
      });
    }
  };
}

function containerMutation(runtime, endpoint, containerId) {
  return mutation(runtime, endpoint, { containerId: normalizeId(containerId) });
}

function mutation(runtime, endpoint, body) {
  return runtime.api.call(endpoint, {
    method: "POST",
    body: normalizeBody(body)
  });
}

function ensureApiRuntime(runtimeInput) {
  const runtime = runtimeInput || globalThis.space;
  if (!runtime?.api || typeof runtime.api.call !== "function") {
    throw new Error("Orchestrator Docker client requires space.api.call.");
  }

  return runtime;
}

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeBody(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function normalizeQuery(value) {
  return normalizeBody(value);
}

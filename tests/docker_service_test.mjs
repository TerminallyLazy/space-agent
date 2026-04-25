import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAdmin,
  createDockerService,
  normalizeContainerSummary,
  resolveDockerOptions
} from "../server/lib/docker/client.js";

function createRuntimeParams(values = {}) {
  return { get: (name, fallback = undefined) => values[name] ?? fallback };
}

test("resolveDockerOptions uses DOCKER_HOST when set", () => {
  assert.deepEqual(resolveDockerOptions(createRuntimeParams({ DOCKER_HOST: "tcp://127.0.0.1:2375" })), {
    host: "127.0.0.1",
    port: "2375",
    protocol: "http"
  });
  assert.deepEqual(resolveDockerOptions(createRuntimeParams({ DOCKER_HOST: "" })), {
    socketPath: "/var/run/docker.sock"
  });
});

test("assertAdmin accepts _admin and rejects normal users", () => {
  assert.doesNotThrow(() => assertAdmin({ user: { groups: ["_admin"] } }));
  assert.throws(() => assertAdmin({ user: { groups: ["users"] } }), /_admin/u);
});

test("normalizeContainerSummary returns stable container fields", () => {
  const summary = normalizeContainerSummary({
    Id: "abc123",
    Names: ["/web"],
    Image: "nginx:latest",
    State: "running",
    Status: "Up 10 seconds",
    Ports: [{ PublicPort: 8080, PrivatePort: 80, Type: "tcp" }],
    Labels: { "space.orchestrator.graph": "graph-1" }
  });

  assert.deepEqual(summary, {
    id: "abc123",
    name: "web",
    image: "nginx:latest",
    state: "running",
    status: "Up 10 seconds",
    ports: [{ host: 8080, container: 80, type: "tcp" }],
    labels: { "space.orchestrator.graph": "graph-1" },
    managed: true
  });
});

test("createDockerService delegates list and start to docker client", async () => {
  const calls = [];
  const docker = {
    listContainers: async (options) => {
      calls.push(["listContainers", options]);
      return [];
    },
    getContainer(id) {
      return {
        start: async () => calls.push(["start", id])
      };
    }
  };
  const service = createDockerService({ docker });
  await service.list();
  await service.start("abc");

  assert.deepEqual(calls, [
    ["listContainers", { all: true }],
    ["start", "abc"]
  ]);
});

test("docker_start endpoint delegates to service", async () => {
  const module = await import("../server/api/docker_start.js?test=start");
  const calls = [];
  const result = await module.post({
    body: { containerId: "abc" },
    dockerService: {
      start: async (containerId) => {
        calls.push(containerId);
        return { ok: true, containerId };
      }
    }
  });

  assert.deepEqual(calls, ["abc"]);
  assert.deepEqual(result, { ok: true, containerId: "abc" });
});

test("docker_exec endpoint requires admin", async () => {
  const module = await import("../server/api/docker_exec.js?test=exec");
  await assert.rejects(() => module.post({
    user: { groups: ["users"] },
    body: { containerId: "abc", command: "ls" }
  }), /_admin/u);
});

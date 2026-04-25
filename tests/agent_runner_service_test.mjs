import assert from "node:assert/strict";
import test from "node:test";

import {
  createRunRecord,
  createRunnerService,
  normalizeRunRequest,
  redactRunRequest
} from "../server/lib/agent_runners/service.js";

test("normalizeRunRequest validates provider and secret", () => {
  const request = normalizeRunRequest({
    graphId: "graph-1",
    nodeId: "node-a",
    provider: "openai",
    input: "Plan",
    credential: { provider: "openai", secret: "sk" },
    node: { config: { model: "gpt-5.4" } }
  });

  assert.equal(request.provider, "openai");
  assert.equal(request.credential.secret, "sk");
  assert.throws(
    () => normalizeRunRequest({ provider: "openai", credential: { provider: "anthropic", secret: "sk" } }),
    /Credential provider/u
  );
});

test("redactRunRequest removes secrets", () => {
  const redacted = redactRunRequest({ credential: { provider: "openai", secret: "sk-test" } });
  assert.deepEqual(redacted.credential, { provider: "openai", secret: "[redacted]" });
});

test("createRunRecord stores compact status", () => {
  const run = createRunRecord({ graphId: "graph-1", nodeId: "node-a", provider: "openai" });
  assert.match(run.id, /^run-/u);
  assert.equal(run.status, "running");
});

test("agent_run_start endpoint delegates to runner service", async () => {
  const module = await import("../server/api/agent_run_start.js?test=start");
  const result = await module.post({
    body: { provider: "openai" },
    runnerService: {
      start: async (payload) => ({ id: "run-1", status: "completed", provider: payload.provider })
    }
  });
  assert.deepEqual(result, { id: "run-1", status: "completed", provider: "openai" });
});

test("agent_run_events endpoint returns events", async () => {
  const module = await import("../server/api/agent_run_events.js?test=events");
  const result = await module.get({
    query: { runId: "run-1" },
    runnerService: {
      events: (runId) => [{ runId, type: "result" }]
    }
  });
  assert.deepEqual(result, [{ runId: "run-1", type: "result" }]);
});

test("runner service stores status and events", async () => {
  const service = createRunnerService({
    adapters: {
      openai: {
        run: async function* () {
          yield { type: "status", payload: { status: "running" } };
          yield { type: "result", payload: { finalOutput: "done" } };
        }
      }
    }
  });

  const started = await service.start({
    graphId: "graph-1",
    nodeId: "node-a",
    provider: "openai",
    input: "Plan",
    credential: { provider: "openai", secret: "sk" }
  });

  assert.equal(started.status, "completed");
  assert.equal(service.status(started.id).status, "completed");
  assert.equal(service.events(started.id).length, 2);
});

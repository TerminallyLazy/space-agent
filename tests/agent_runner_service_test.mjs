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

import assert from "node:assert/strict";
import test from "node:test";

import { decryptCredentialForRun, writeCredential } from "../app/L0/_all/mod/_core/orchestrator/credentials.js";
import { createDockerClient } from "../app/L0/_all/mod/_core/orchestrator/docker-client.js";
import { createRunnerClient } from "../app/L0/_all/mod/_core/orchestrator/runner-client.js";
import { buildRunRequest } from "../app/L0/_all/mod/_core/orchestrator/agent-adapters.js";

function createRuntime() {
  const calls = [];
  const files = new Map();
  return {
    calls,
    files,
    runtime: {
      api: {
        async call(endpoint, options = {}) {
          calls.push({ endpoint, options });
          return { endpoint, ok: true };
        },
        async fileRead(path) {
          return { content: files.get(path) };
        },
        async fileWrite({ path, content }) {
          files.set(path, content);
          return { path };
        }
      },
      utils: {
        yaml: {
          parse: JSON.parse,
          stringify: (value) => JSON.stringify(value, null, 2)
        },
        userCrypto: {
          async encryptText(text) {
            return `enc:${text}`;
          },
          async decryptText(text) {
            return String(text).replace(/^enc:/u, "");
          }
        }
      }
    }
  };
}

test("docker client calls object-first endpoints", async () => {
  const { runtime, calls } = createRuntime();
  const docker = createDockerClient(runtime);
  await docker.start("abc");
  await docker.logs("abc", { tail: 25 });

  assert.equal(calls[0].endpoint, "docker_start");
  assert.deepEqual(calls[0].options.body, { containerId: "abc" });
  assert.equal(calls[1].endpoint, "docker_logs");
  assert.match(calls[1].options.query.containerId, /abc/u);
});

test("runner client starts normalized runs", async () => {
  const { runtime, calls } = createRuntime();
  const runner = createRunnerClient(runtime);
  await runner.start({ provider: "openai", input: "hello" });

  assert.equal(calls[0].endpoint, "agent_run_start");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.provider, "openai");
});

test("credentials are encrypted at rest and decrypted for one run", async () => {
  const { runtime, files } = createRuntime();
  await writeCredential({ ref: "openai-main", provider: "openai", secret: "sk-test" }, runtime);
  assert.match(files.get("~/orchestrator/secrets/openai-main.yaml"), /enc:sk-test/u);

  const credential = await decryptCredentialForRun("openai-main", runtime);
  assert.deepEqual(credential, { provider: "openai", secret: "sk-test" });
});

test("buildRunRequest rejects provider mismatch and includes node config", async () => {
  const node = {
    id: "node-openai",
    type: "openai_agent",
    name: "Planner",
    config: { model: "gpt-5.4", instructions: "Plan." },
    runtime: { credentialRef: "openai-main" }
  };
  const request = buildRunRequest({ graphId: "graph-1", node, input: "Do it", credential: { provider: "openai", secret: "sk" } });

  assert.equal(request.provider, "openai");
  assert.equal(request.nodeId, "node-openai");
  assert.equal(request.credential.secret, "sk");
  assert.throws(() => buildRunRequest({ graphId: "graph-1", node, input: "Do it", credential: { provider: "anthropic", secret: "sk" } }), /Credential provider/u);
});

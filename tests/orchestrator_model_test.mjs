import assert from "node:assert/strict";
import test from "node:test";

import {
  ORCHESTRATOR_GRAPH_SCHEMA,
  ORCHESTRATOR_NODE_SCHEMA
} from "../app/L0/_all/mod/_core/orchestrator/constants.js";
import {
  deriveEdgeType,
  normalizeEdge,
  resolveEdgeColor
} from "../app/L0/_all/mod/_core/orchestrator/edges.js";
import {
  createDefaultNode,
  getNodeCategory,
  normalizeNode
} from "../app/L0/_all/mod/_core/orchestrator/node-types.js";

test("orchestrator schemas are versioned", () => {
  assert.equal(ORCHESTRATOR_GRAPH_SCHEMA, "orchestrator-graph/v1");
  assert.equal(ORCHESTRATOR_NODE_SCHEMA, "orchestrator-node/v1");
});

test("createDefaultNode creates typed defaults", () => {
  const docker = createDefaultNode({ type: "docker_container", name: "Web", x: 10, y: 20 });
  assert.equal(docker.schema, "orchestrator-node/v1");
  assert.equal(docker.type, "docker_container");
  assert.equal(docker.name, "Web");
  assert.equal(docker.x, 10);
  assert.equal(docker.y, 20);
  assert.equal(docker.config.mode, "managed");
  assert.equal(docker.runtime.mode, "docker");

  const openai = createDefaultNode({ type: "openai_agent", name: "Planner" });
  assert.equal(openai.config.model, "gpt-5.4");
  assert.equal(openai.runtime.mode, "server_sdk");
});

test("normalizeNode clamps coordinates and preserves credential refs", () => {
  const node = normalizeNode({
    schema: "wrong",
    id: "node-x",
    type: "claude_agent",
    name: "  Claude  ",
    x: Number.NaN,
    y: 12.5,
    runtime: { credentialRef: "claude-main" }
  });

  assert.equal(node.schema, "orchestrator-node/v1");
  assert.equal(node.name, "Claude");
  assert.equal(node.x, 0);
  assert.equal(node.y, 12.5);
  assert.equal(node.runtime.credentialRef, "claude-main");
});

test("node categories support hybrid Agent Zero", () => {
  assert.equal(getNodeCategory({ type: "docker_container" }), "container");
  assert.equal(getNodeCategory({ type: "openai_agent" }), "agent");
  assert.equal(getNodeCategory({ type: "agent_zero" }), "hybrid");
});

test("deriveEdgeType follows source and target categories", () => {
  assert.equal(deriveEdgeType({ type: "docker_container" }, { type: "docker_container" }), "network");
  assert.equal(deriveEdgeType({ type: "openai_agent" }, { type: "docker_container" }), "control");
  assert.equal(deriveEdgeType({ type: "docker_container" }, { type: "claude_agent" }), "monitor");
  assert.equal(deriveEdgeType({ type: "claude_agent" }, { type: "openai_agent" }), "delegate");
});

test("normalizeEdge rejects self loops and duplicate keys", () => {
  assert.throws(() => normalizeEdge({
    source: "node-a",
    target: "node-a"
  }, {
    nodesById: { "node-a": { type: "openai_agent" } },
    existingEdges: []
  }), /self-loop/u);

  assert.throws(() => normalizeEdge({
    source: "node-a",
    target: "node-b"
  }, {
    nodesById: {
      "node-a": { type: "openai_agent" },
      "node-b": { type: "openai_agent" }
    },
    existingEdges: [{ source: "node-a", target: "node-b" }]
  }), /duplicate/u);
});

test("edge colors are stable semantic values", () => {
  assert.equal(resolveEdgeColor("network"), "rgba(74, 158, 255, 0.68)");
  assert.equal(resolveEdgeColor("control"), "rgba(255, 180, 50, 0.78)");
  assert.equal(resolveEdgeColor("monitor"), "rgba(50, 200, 100, 0.74)");
  assert.equal(resolveEdgeColor("delegate"), "rgba(160, 100, 255, 0.76)");
});

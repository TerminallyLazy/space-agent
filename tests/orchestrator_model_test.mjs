import assert from "node:assert/strict";
import test from "node:test";

import {
  ORCHESTRATOR_GRAPH_SCHEMA,
  ORCHESTRATOR_NODE_SCHEMA
} from "../app/L0/_all/mod/_core/orchestrator/constants.js";
import {
  canvasToWorld,
  clampZoom,
  createCamera,
  createZoomedCamera,
  worldToCanvas
} from "../app/L0/_all/mod/_core/orchestrator/canvas.js";
import {
  deriveEdgeType,
  normalizeEdge,
  resolveEdgeColor
} from "../app/L0/_all/mod/_core/orchestrator/edges.js";
import {
  createMessageBus,
  normalizeBusMessage
} from "../app/L0/_all/mod/_core/orchestrator/message-bus.js";
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

test("node defaults do not share nested mutable references", () => {
  const docker = createDefaultNode({ type: "docker_container" });
  docker.config.ports.push({ host: 8080, container: 80 });
  docker.runtime.credentialRef = "docker-main";

  const nextDocker = createDefaultNode({ type: "docker_container" });
  assert.deepEqual(nextDocker.config.ports, []);
  assert.equal(nextDocker.runtime.credentialRef, "");

  const openai = normalizeNode({ type: "openai_agent" });
  openai.config.sandbox.enabled = true;
  openai.config.tools.push({ name: "search" });

  const nextOpenai = normalizeNode({ type: "openai_agent" });
  assert.deepEqual(nextOpenai.config.sandbox, { enabled: false });
  assert.deepEqual(nextOpenai.config.tools, []);
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

test("normalizeEdge falls back from blank ids and rejects unsupported types", () => {
  const edge = normalizeEdge({
    id: "   ",
    source: "node-a",
    target: "node-b",
    type: "   "
  }, {
    nodesById: {
      "node-a": { type: "openai_agent" },
      "node-b": { type: "docker_container" }
    },
    existingEdges: []
  });

  assert.equal(edge.id, "edge-node-a-node-b");
  assert.equal(edge.type, "control");

  assert.throws(() => normalizeEdge({
    source: "node-a",
    target: "node-b",
    type: "webhook"
  }, {
    nodesById: {
      "node-a": { type: "openai_agent" },
      "node-b": { type: "docker_container" }
    },
    existingEdges: []
  }), /Unsupported edge type/u);
});

test("edge colors are stable semantic values", () => {
  assert.equal(resolveEdgeColor("network"), "rgba(74, 158, 255, 0.68)");
  assert.equal(resolveEdgeColor("control"), "rgba(255, 180, 50, 0.78)");
  assert.equal(resolveEdgeColor("monitor"), "rgba(50, 200, 100, 0.74)");
  assert.equal(resolveEdgeColor("delegate"), "rgba(160, 100, 255, 0.76)");
});

test("canvas camera converts coordinates and zooms toward pointer", () => {
  const camera = createCamera({ x: 10, y: 20, zoom: 2 });
  assert.deepEqual(canvasToWorld(camera, 30, 60), { x: 10, y: 20 });
  assert.deepEqual(worldToCanvas(camera, 10, 20), { x: 30, y: 60 });
  assert.equal(clampZoom(10), 3);
  assert.equal(clampZoom(0.01), 0.1);

  const zoomed = createZoomedCamera({
    camera: { x: 0, y: 0, zoom: 1 },
    nextZoom: 2,
    pointerX: 100,
    pointerY: 100
  });
  assert.deepEqual(zoomed, { x: -100, y: -100, zoom: 2 });
});

test("canvas zoom keeps fractional world point anchored under pointer", () => {
  const camera = { x: 0, y: 0, zoom: 3 };
  const pointer = { x: 1, y: 1 };
  const worldPoint = {
    x: (pointer.x - camera.x) / camera.zoom,
    y: (pointer.y - camera.y) / camera.zoom
  };

  const zoomed = createZoomedCamera({
    camera,
    nextZoom: 0.1,
    pointerX: pointer.x,
    pointerY: pointer.y
  });
  const anchoredWorldPoint = {
    x: (pointer.x - zoomed.x) / zoomed.zoom,
    y: (pointer.y - zoomed.y) / zoomed.zoom
  };

  assert.ok(Math.abs(anchoredWorldPoint.x - worldPoint.x) < 1e-12);
  assert.ok(Math.abs(anchoredWorldPoint.y - worldPoint.y) < 1e-12);
});

test("message bus routes only across allowed graph edges", () => {
  const bus = createMessageBus({
    graphId: "graph-1",
    edges: [{ source: "node-a", target: "node-b", protocol: "internal" }]
  });

  const delivered = [];
  bus.subscribe((message) => delivered.push(message));
  bus.send({ source: "node-a", target: "node-b", type: "task", payload: { input: "hello" } });

  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].graphId, "graph-1");
  assert.equal(delivered[0].type, "task");

  assert.throws(() => {
    bus.send({ source: "node-b", target: "node-a", type: "task", payload: {} });
  }, /No edge allows/u);
});

test("message bus rejects messages for a different graph", () => {
  const bus = createMessageBus({
    graphId: "graph-1",
    edges: [{ source: "node-a", target: "node-b", protocol: "internal" }]
  });

  assert.throws(() => {
    bus.send({ graphId: "graph-2", source: "node-a", target: "node-b", type: "task" });
  }, /graphId/u);
});

test("message bus requires matching edge protocol", () => {
  const bus = createMessageBus({
    graphId: "graph-1",
    edges: [{ source: "node-a", target: "node-b", protocol: "internal" }]
  });

  const delivered = [];
  bus.subscribe((message) => delivered.push(message));

  bus.send({ source: "node-a", target: "node-b", type: "task" });
  bus.send({ source: "node-a", target: "node-b", protocol: "internal", type: "status" });

  assert.equal(delivered.length, 2);
  assert.equal(delivered[0].protocol, "internal");
  assert.equal(delivered[1].protocol, "internal");
  assert.throws(() => {
    bus.send({ source: "node-a", target: "node-b", protocol: "a2a", type: "task" });
  }, /No edge allows/u);
});

test("normalizeBusMessage uses stable defaults", () => {
  const message = normalizeBusMessage({
    graphId: "graph-1",
    source: "node-a",
    target: "node-b",
    payload: { ok: true }
  });

  assert.match(message.id, /^msg-/u);
  assert.equal(message.type, "task");
  assert.equal(message.protocol, "internal");
});

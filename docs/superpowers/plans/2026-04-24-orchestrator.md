# Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-party Orchestrator module with an infinite node-graph canvas, YAML persistence, Docker topology control, Claude/OpenAI runner endpoints, encrypted per-run credentials, and graph-open message routing.

**Architecture:** The browser owns the graph UI, graph state, app-file persistence, encrypted credential handling, and live message bus. The server owns only Docker socket access, SDK runner execution, and narrow A2A forwarding. Provider-specific behavior is normalized through small adapter/client files so graph schema remains provider-neutral.

**Tech Stack:** Space Agent L0 modules, Alpine stores via `space.fw.createStore`, `space.api`, `space.utils.yaml`, Node.js `node:test`, Docker via `dockerode`, Claude Agent SDK `@anthropic-ai/claude-agent-sdk`, OpenAI Agents SDK `@openai/agents`, `zod`, browser harness/manual route verification.

---

## Source References

- Approved design spec: `docs/superpowers/specs/2026-04-24-orchestrator-design.md`
- Claude Agent SDK TypeScript package and `query()` streaming API: https://platform.claude.com/docs/en/agent-sdk/typescript
- OpenAI Agents SDK TypeScript package, `Agent`, `run`, tools, handoffs, sessions, and tracing: https://openai.github.io/openai-agents-js/
- OpenAI agent definition guide: https://openai.github.io/openai-agents-js/guides/agents/

## File Structure

Create:

- `app/L0/_all/mod/_core/orchestrator/AGENTS.md`: local runtime contract for Orchestrator.
- `app/L0/_all/mod/_core/orchestrator/constants.js`: route, schema, path, status, edge, and runtime constants.
- `app/L0/_all/mod/_core/orchestrator/graph-metadata.js`: title/icon/color normalization.
- `app/L0/_all/mod/_core/orchestrator/node-types.js`: node defaults, normalization, category helpers, edge typing.
- `app/L0/_all/mod/_core/orchestrator/edges.js`: Bezier path helpers, connection rules, edge normalization.
- `app/L0/_all/mod/_core/orchestrator/message-bus.js`: graph-open message routing and compact event batching.
- `app/L0/_all/mod/_core/orchestrator/canvas.js`: camera math, pointer transforms, drag state helpers.
- `app/L0/_all/mod/_core/orchestrator/storage.js`: `~/orchestrator/` YAML persistence.
- `app/L0/_all/mod/_core/orchestrator/credentials.js`: encrypted credential read/write/decrypt helpers.
- `app/L0/_all/mod/_core/orchestrator/docker-client.js`: frontend Docker API wrapper.
- `app/L0/_all/mod/_core/orchestrator/runner-client.js`: frontend runner/A2A API wrapper.
- `app/L0/_all/mod/_core/orchestrator/agent-adapters.js`: browser-side adapter registry and run request shaping.
- `app/L0/_all/mod/_core/orchestrator/store.js`: Alpine page store and `space.orchestrator` namespace.
- `app/L0/_all/mod/_core/orchestrator/view.html`: routed graph page.
- `app/L0/_all/mod/_core/orchestrator/orchestrator.css`: full-bleed canvas, cards, ports, toolbar, dialogs.
- `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/content_middle/orchestrator-dashboard-launcher.html`: dashboard launcher adapter.
- `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/topbar_primary/new-graph.html`: dashboard new-graph adapter.
- `app/L0/_all/mod/_core/orchestrator/ext/html/_core/onscreen_menu/items/orchestrator.html`: shell menu item.
- `app/L0/_all/mod/_core/orchestrator/ext/skills/orchestrator/SKILL.md`: transient Orchestrator skill.
- `server/lib/docker/client.js`: Docker connection and operation helper.
- `server/lib/docker/AGENTS.md`: Docker helper contract.
- `server/lib/agent_runners/claude.js`: Claude Agent SDK adapter.
- `server/lib/agent_runners/openai.js`: OpenAI Agents SDK adapter.
- `server/lib/agent_runners/a2a.js`: A2A forwarding helper.
- `server/lib/agent_runners/service.js`: normalized runner service.
- `server/lib/agent_runners/AGENTS.md`: runner helper contract.
- `server/api/docker_list.js`
- `server/api/docker_inspect.js`
- `server/api/docker_create.js`
- `server/api/docker_start.js`
- `server/api/docker_stop.js`
- `server/api/docker_restart.js`
- `server/api/docker_remove.js`
- `server/api/docker_logs.js`
- `server/api/docker_exec.js`
- `server/api/docker_network_create.js`
- `server/api/docker_network_connect.js`
- `server/api/docker_network_disconnect.js`
- `server/api/agent_run_start.js`
- `server/api/agent_run_status.js`
- `server/api/agent_run_stop.js`
- `server/api/agent_run_events.js`
- `tests/orchestrator_model_test.mjs`: frontend pure model tests.
- `tests/orchestrator_storage_test.mjs`: mocked `space.api` storage tests.
- `tests/orchestrator_clients_test.mjs`: frontend API wrapper tests.
- `tests/docker_service_test.mjs`: mocked Docker helper tests.
- `tests/agent_runner_service_test.mjs`: mocked runner adapter tests.

Modify:

- `package.json`: add runtime dependencies.
- `package-lock.json`: lock dependencies after `npm install`.
- `commands/params.yaml`: add `DOCKER_HOST`.
- `app/L0/_all/mod/_core/router/router.css`: add full-bleed route override for `orchestrator`.
- `AGENTS.md`: add Orchestrator, Docker helper, and runner helper docs to the index.
- `app/AGENTS.md`: add Orchestrator module to docs list and major owners.
- `server/AGENTS.md`: list Docker and agent runner helper ownership when helper docs are added.
- `server/api/AGENTS.md`: document Docker and runner endpoint families.
- `commands/AGENTS.md`: document `DOCKER_HOST`.
- `tests/AGENTS.md`: list new Orchestrator tests.
- `app/L0/_all/mod/_core/documentation/docs/app/modules-and-extensions.md`: add Orchestrator module summary.
- `app/L0/_all/mod/_core/documentation/docs/app/runtime-and-layers.md`: mention `~/orchestrator/` persistence and encrypted credential records.
- `app/L0/_all/mod/_core/documentation/docs/server/api/modules-and-runtime.md`: document Docker/runner endpoint families.
- `app/L0/_all/mod/_core/documentation/docs/cli/commands-and-runtime-params.md`: document `DOCKER_HOST`.
- `app/L0/_all/mod/_core/documentation/ext/skills/documentation/SKILL.md`: update docs map if it lists app/server docs explicitly.

---

### Task 1: Dependencies And Runtime Parameter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `commands/params.yaml`
- Test: `tests/set_command_test.mjs`

- [ ] **Step 1: Add the runtime parameter test**

Add this assertion to `tests/set_command_test.mjs` in the existing schema-validation test area:

```js
const dockerHostSpec = specs.find((entry) => entry.name === "DOCKER_HOST");
assert.ok(dockerHostSpec);
assert.equal(dockerHostSpec.defaultValue, "");
assert.equal(dockerHostSpec.frontendExposed, false);
assert.equal(validateConfigValue(dockerHostSpec, "unix:///var/run/docker.sock"), "unix:///var/run/docker.sock");
assert.equal(validateConfigValue(dockerHostSpec, ""), "");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
node --test tests/set_command_test.mjs
```

Expected: FAIL with an unknown runtime parameter or schema validation error for `DOCKER_HOST`.

- [ ] **Step 3: Add dependencies and parameter**

Run:

```bash
npm install dockerode @anthropic-ai/claude-agent-sdk @openai/agents zod
```

Add this block to `commands/params.yaml` after `GIT_URL`:

```yaml
DOCKER_HOST:
  description: Docker socket path or TCP host for Docker API access.
  type: text
  allowed: ["*"]
  default: ""
  frontend_exposed: false
```

Verify `package.json` contains dependency keys for `@anthropic-ai/claude-agent-sdk`, `@openai/agents`, `dockerode`, and `zod`. Keep the semver values written by `npm install`; do not hand-edit the lockfile.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
node --test tests/set_command_test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json commands/params.yaml tests/set_command_test.mjs
git commit -m "Add orchestrator runtime dependencies"
```

---

### Task 2: Pure Graph Model

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/constants.js`
- Create: `app/L0/_all/mod/_core/orchestrator/graph-metadata.js`
- Create: `app/L0/_all/mod/_core/orchestrator/node-types.js`
- Create: `app/L0/_all/mod/_core/orchestrator/edges.js`
- Test: `tests/orchestrator_model_test.mjs`

- [ ] **Step 1: Write model tests**

Create `tests/orchestrator_model_test.mjs`:

```js
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
```

- [ ] **Step 2: Run the model tests to verify they fail**

Run:

```bash
node --test tests/orchestrator_model_test.mjs
```

Expected: FAIL because the Orchestrator modules do not exist.

- [ ] **Step 3: Implement constants**

Create `app/L0/_all/mod/_core/orchestrator/constants.js`:

```js
export const ORCHESTRATOR_ROUTE_PATH = "orchestrator";
export const ORCHESTRATOR_ROOT_PATH = "~/orchestrator/";
export const ORCHESTRATOR_GRAPH_SCHEMA = "orchestrator-graph/v1";
export const ORCHESTRATOR_NODE_SCHEMA = "orchestrator-node/v1";
export const ORCHESTRATOR_GRAPH_FILE = "graph.yaml";
export const ORCHESTRATOR_NODES_DIR = "nodes/";
export const ORCHESTRATOR_RUNS_DIR = "runs/";
export const ORCHESTRATOR_MESSAGES_DIR = "messages/";
export const ORCHESTRATOR_SECRETS_DIR = "secrets/";
export const ORCHESTRATOR_STORE_NAME = "orchestratorPage";

export const CAMERA_DEFAULT = Object.freeze({ x: 0, y: 0, zoom: 1 });
export const CAMERA_MIN_ZOOM = 0.1;
export const CAMERA_MAX_ZOOM = 3;

export const NODE_TYPES = Object.freeze([
  "docker_container",
  "space_agent",
  "agent_zero",
  "claude_agent",
  "openai_agent",
  "external_a2a_agent"
]);

export const EDGE_TYPES = Object.freeze(["network", "control", "monitor", "delegate"]);
export const EDGE_PROTOCOLS = Object.freeze(["internal", "a2a"]);

export const EDGE_COLORS = Object.freeze({
  network: "rgba(74, 158, 255, 0.68)",
  control: "rgba(255, 180, 50, 0.78)",
  monitor: "rgba(50, 200, 100, 0.74)",
  delegate: "rgba(160, 100, 255, 0.76)"
});
```

- [ ] **Step 4: Implement metadata helpers**

Create `app/L0/_all/mod/_core/orchestrator/graph-metadata.js`:

```js
const DEFAULT_GRAPH_TITLE = "Untitled Orchestration";
const DEFAULT_GRAPH_ICON = "account_tree";
const DEFAULT_GRAPH_ICON_COLOR = "#4a9eff";

export function normalizeInlineText(value, fallback = "") {
  const text = String(value ?? "").replace(/\s+/gu, " ").trim();
  return text || fallback;
}

export function normalizeGraphTitle(value) {
  return normalizeInlineText(value, DEFAULT_GRAPH_TITLE).slice(0, 120);
}

export function normalizeGraphIcon(value) {
  return normalizeInlineText(value, DEFAULT_GRAPH_ICON).replace(/[^a-z0-9_]/giu, "") || DEFAULT_GRAPH_ICON;
}

export function normalizeGraphIconColor(value) {
  const color = normalizeInlineText(value, DEFAULT_GRAPH_ICON_COLOR);
  return /^#[0-9a-f]{6}$/iu.test(color) ? color.toLowerCase() : DEFAULT_GRAPH_ICON_COLOR;
}

export function getGraphDisplayTitle(graph) {
  return normalizeGraphTitle(graph?.title);
}
```

- [ ] **Step 5: Implement node types**

Create `app/L0/_all/mod/_core/orchestrator/node-types.js` with these exported functions and the complete default map:

```js
import { NODE_TYPES, ORCHESTRATOR_NODE_SCHEMA } from "./constants.js";
import { normalizeInlineText } from "./graph-metadata.js";

const NODE_TYPE_SET = new Set(NODE_TYPES);

const DEFAULT_CONFIG_BY_TYPE = Object.freeze({
  docker_container: Object.freeze({
    mode: "managed",
    containerId: "",
    image: "nginx",
    tag: "latest",
    ports: [],
    environment: [],
    volumes: [],
    command: ""
  }),
  space_agent: Object.freeze({
    endpoint: "local",
    instructions: "",
    deploy: { mode: "local" }
  }),
  agent_zero: Object.freeze({
    mode: "managed",
    image: "frdel/agent-zero-run:latest",
    containerId: "",
    endpoint: "",
    ports: [{ host: 50001, container: 80 }],
    environment: [],
    volumes: []
  }),
  claude_agent: Object.freeze({
    model: "claude-sonnet-4-5",
    prompt: "",
    allowedTools: [],
    permissionMode: "default",
    maxTurns: 8,
    mcpServers: []
  }),
  openai_agent: Object.freeze({
    model: "gpt-5.4",
    instructions: "",
    tools: [],
    handoffs: [],
    guardrails: [],
    sandbox: { enabled: false }
  }),
  external_a2a_agent: Object.freeze({
    agentCardUrl: "",
    endpoint: "",
    authHeaderRef: ""
  })
});

const DEFAULT_RUNTIME_BY_TYPE = Object.freeze({
  docker_container: Object.freeze({ mode: "docker", credentialRef: "" }),
  space_agent: Object.freeze({ mode: "local", credentialRef: "" }),
  agent_zero: Object.freeze({ mode: "docker", credentialRef: "" }),
  claude_agent: Object.freeze({ mode: "server_sdk", credentialRef: "" }),
  openai_agent: Object.freeze({ mode: "server_sdk", credentialRef: "" }),
  external_a2a_agent: Object.freeze({ mode: "external", credentialRef: "" })
});

export function normalizeNodeType(value) {
  const type = String(value || "").trim();
  return NODE_TYPE_SET.has(type) ? type : "docker_container";
}

export function getNodeCategory(node) {
  const type = normalizeNodeType(node?.type);
  if (type === "docker_container") return "container";
  if (type === "agent_zero") return "hybrid";
  return "agent";
}

export function createNodeId(randomSource = globalThis.crypto) {
  const bytes = new Uint8Array(4);
  if (randomSource?.getRandomValues) {
    randomSource.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `node-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function createDefaultNode(options = {}) {
  const type = normalizeNodeType(options.type);
  return normalizeNode({
    schema: ORCHESTRATOR_NODE_SCHEMA,
    id: options.id || createNodeId(options.randomSource),
    type,
    name: options.name || defaultNameForType(type),
    x: options.x,
    y: options.y,
    status: options.status || "idle",
    config: { ...DEFAULT_CONFIG_BY_TYPE[type], ...(options.config || {}) },
    runtime: { ...DEFAULT_RUNTIME_BY_TYPE[type], ...(options.runtime || {}) }
  });
}

export function normalizeNode(source = {}) {
  const type = normalizeNodeType(source.type);
  return {
    schema: ORCHESTRATOR_NODE_SCHEMA,
    id: normalizeInlineText(source.id, createNodeId()),
    type,
    name: normalizeInlineText(source.name, defaultNameForType(type)).slice(0, 80),
    x: normalizeCoordinate(source.x),
    y: normalizeCoordinate(source.y),
    status: normalizeInlineText(source.status, "idle"),
    config: { ...DEFAULT_CONFIG_BY_TYPE[type], ...(source.config && typeof source.config === "object" ? source.config : {}) },
    runtime: { ...DEFAULT_RUNTIME_BY_TYPE[type], ...(source.runtime && typeof source.runtime === "object" ? source.runtime : {}) }
  };
}

function defaultNameForType(type) {
  return {
    docker_container: "Docker Container",
    space_agent: "Space Agent",
    agent_zero: "Agent Zero",
    claude_agent: "Claude Agent",
    openai_agent: "OpenAI Agent",
    external_a2a_agent: "A2A Agent"
  }[type] || "Node";
}

function normalizeCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}
```

- [ ] **Step 6: Implement edge helpers**

Create `app/L0/_all/mod/_core/orchestrator/edges.js`:

```js
import { EDGE_COLORS, EDGE_PROTOCOLS } from "./constants.js";
import { getNodeCategory } from "./node-types.js";

export function deriveEdgeType(sourceNode, targetNode) {
  const sourceCategory = getNodeCategory(sourceNode);
  const targetCategory = getNodeCategory(targetNode);

  if ((sourceCategory === "container" || sourceCategory === "hybrid") && (targetCategory === "container" || targetCategory === "hybrid")) {
    return "network";
  }
  if ((sourceCategory === "agent" || sourceCategory === "hybrid") && targetCategory === "container") {
    return "control";
  }
  if (sourceCategory === "container" && (targetCategory === "agent" || targetCategory === "hybrid")) {
    return "monitor";
  }
  if ((sourceCategory === "agent" || sourceCategory === "hybrid") && (targetCategory === "agent" || targetCategory === "hybrid")) {
    return "delegate";
  }

  throw new Error(`Unsupported edge from ${sourceCategory} to ${targetCategory}.`);
}

export function normalizeEdge(source = {}, options = {}) {
  const sourceId = String(source.source || "").trim();
  const targetId = String(source.target || "").trim();

  if (!sourceId || !targetId) {
    throw new Error("An edge requires source and target node ids.");
  }
  if (sourceId === targetId) {
    throw new Error("Cannot create a self-loop edge.");
  }
  if ((options.existingEdges || []).some((edge) => edge.source === sourceId && edge.target === targetId)) {
    throw new Error("Cannot create a duplicate edge.");
  }

  const sourceNode = options.nodesById?.[sourceId];
  const targetNode = options.nodesById?.[targetId];

  if (!sourceNode || !targetNode) {
    throw new Error("Cannot create an edge with a missing endpoint.");
  }

  const type = source.type || deriveEdgeType(sourceNode, targetNode);
  const protocol = EDGE_PROTOCOLS.includes(source.protocol) ? source.protocol : "internal";

  return {
    id: String(source.id || `edge-${sourceId}-${targetId}`).trim(),
    source: sourceId,
    target: targetId,
    type,
    label: String(source.label || "").trim(),
    protocol
  };
}

export function resolveEdgeColor(type) {
  return EDGE_COLORS[type] || EDGE_COLORS.delegate;
}

export function createBezierPath({ sourceX, sourceY, targetX, targetY, zoom = 1 }) {
  const offset = 120 * Number(zoom || 1);
  return `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY}, ${targetX - offset} ${targetY}, ${targetX} ${targetY}`;
}
```

- [ ] **Step 7: Run the model tests**

Run:

```bash
node --test tests/orchestrator_model_test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/constants.js app/L0/_all/mod/_core/orchestrator/graph-metadata.js app/L0/_all/mod/_core/orchestrator/node-types.js app/L0/_all/mod/_core/orchestrator/edges.js tests/orchestrator_model_test.mjs
git commit -m "Add orchestrator graph model"
```

---

### Task 3: Canvas And Message Bus Helpers

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/canvas.js`
- Create: `app/L0/_all/mod/_core/orchestrator/message-bus.js`
- Modify: `tests/orchestrator_model_test.mjs`

- [ ] **Step 1: Add helper tests**

Append these tests to `tests/orchestrator_model_test.mjs`:

```js
import {
  clampZoom,
  createCamera,
  createZoomedCamera,
  canvasToWorld,
  worldToCanvas
} from "../app/L0/_all/mod/_core/orchestrator/canvas.js";
import {
  createMessageBus,
  normalizeBusMessage
} from "../app/L0/_all/mod/_core/orchestrator/message-bus.js";

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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
node --test tests/orchestrator_model_test.mjs
```

Expected: FAIL because `canvas.js` and `message-bus.js` do not exist.

- [ ] **Step 3: Implement canvas helpers**

Create `app/L0/_all/mod/_core/orchestrator/canvas.js`:

```js
import { CAMERA_DEFAULT, CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM } from "./constants.js";

export function clampZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return CAMERA_DEFAULT.zoom;
  return Math.min(CAMERA_MAX_ZOOM, Math.max(CAMERA_MIN_ZOOM, Math.round(zoom * 1000) / 1000));
}

export function createCamera(source = {}) {
  return {
    x: normalizeNumber(source.x, CAMERA_DEFAULT.x),
    y: normalizeNumber(source.y, CAMERA_DEFAULT.y),
    zoom: clampZoom(source.zoom ?? CAMERA_DEFAULT.zoom)
  };
}

export function canvasToWorld(camera, clientX, clientY) {
  const normalizedCamera = createCamera(camera);
  return {
    x: round((Number(clientX) - normalizedCamera.x) / normalizedCamera.zoom),
    y: round((Number(clientY) - normalizedCamera.y) / normalizedCamera.zoom)
  };
}

export function worldToCanvas(camera, worldX, worldY) {
  const normalizedCamera = createCamera(camera);
  return {
    x: round(Number(worldX) * normalizedCamera.zoom + normalizedCamera.x),
    y: round(Number(worldY) * normalizedCamera.zoom + normalizedCamera.y)
  };
}

export function createZoomedCamera({ camera, nextZoom, pointerX, pointerY }) {
  const current = createCamera(camera);
  const worldPoint = canvasToWorld(current, pointerX, pointerY);
  const zoom = clampZoom(nextZoom);

  return createCamera({
    x: Number(pointerX) - worldPoint.x * zoom,
    y: Number(pointerY) - worldPoint.y * zoom,
    zoom
  });
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? round(number) : fallback;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 4: Implement message bus helpers**

Create `app/L0/_all/mod/_core/orchestrator/message-bus.js`:

```js
const MESSAGE_TYPES = new Set(["task", "result", "log", "status", "control"]);
const MESSAGE_PROTOCOLS = new Set(["internal", "a2a"]);

export function normalizeBusMessage(source = {}) {
  const graphId = String(source.graphId || "").trim();
  const sourceNode = String(source.source || "").trim();
  const targetNode = String(source.target || "").trim();

  if (!graphId || !sourceNode || !targetNode) {
    throw new Error("A bus message requires graphId, source, and target.");
  }

  return {
    id: String(source.id || `msg-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`),
    graphId,
    source: sourceNode,
    target: targetNode,
    type: MESSAGE_TYPES.has(source.type) ? source.type : "task",
    protocol: MESSAGE_PROTOCOLS.has(source.protocol) ? source.protocol : "internal",
    createdAt: source.createdAt || new Date().toISOString(),
    payload: source.payload && typeof source.payload === "object" ? source.payload : {}
  };
}

export function createMessageBus({ graphId, edges = [] } = {}) {
  const subscribers = new Set();
  const edgeKeys = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));

  return {
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    send(source) {
      const message = normalizeBusMessage({ ...source, graphId: source.graphId || graphId });
      const key = `${message.source}->${message.target}`;
      if (!edgeKeys.has(key)) {
        throw new Error(`No edge allows ${key}.`);
      }
      subscribers.forEach((callback) => callback(message));
      return message;
    }
  };
}
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
node --test tests/orchestrator_model_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/canvas.js app/L0/_all/mod/_core/orchestrator/message-bus.js tests/orchestrator_model_test.mjs
git commit -m "Add orchestrator canvas and bus helpers"
```

---

### Task 4: YAML Storage Layer

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/storage.js`
- Test: `tests/orchestrator_storage_test.mjs`

- [ ] **Step 1: Write storage tests with a mocked runtime**

Create `tests/orchestrator_storage_test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGraphManifestPath,
  buildNodePath,
  createGraph,
  listGraphs,
  readGraph,
  saveGraph
} from "../app/L0/_all/mod/_core/orchestrator/storage.js";

function createYamlRuntime() {
  const files = new Map();
  const yaml = {
    parse(content) {
      return JSON.parse(content);
    },
    stringify(value) {
      return JSON.stringify(value, null, 2);
    }
  };
  return {
    files,
    runtime: {
      api: {
        async filePaths({ patterns }) {
          const suffix = String(patterns?.[0] || "").replace(/^\*\*\//u, "");
          return {
            paths: [...files.keys()]
              .filter((path) => path.endsWith(suffix))
              .map((path) => ({ path }))
          };
        },
        async fileRead(input) {
          if (Array.isArray(input?.files)) {
            return { files: input.files.map(({ path }) => ({ path, content: files.get(path) })) };
          }
          const path = typeof input === "string" ? input : input.path;
          if (!files.has(path)) {
            const error = new Error("status 404");
            error.statusCode = 404;
            throw error;
          }
          return { path, content: files.get(path) };
        },
        async fileWrite(input) {
          if (Array.isArray(input?.files)) {
            input.files.forEach(({ path, content }) => files.set(path, content));
            return { count: input.files.length };
          }
          files.set(input.path, input.content);
          return { path: input.path };
        }
      },
      utils: { yaml }
    }
  };
}

test("storage path helpers use user orchestrator root", () => {
  assert.equal(buildGraphManifestPath("graph-1"), "~/orchestrator/graph-1/graph.yaml");
  assert.equal(buildNodePath("graph-1", "node-a"), "~/orchestrator/graph-1/nodes/node-a.yaml");
});

test("createGraph persists manifest and readGraph loads nodes", async () => {
  const { runtime, files } = createYamlRuntime();
  const graph = await createGraph({ title: "Ops" }, runtime);

  assert.equal(graph.id, "graph-1");
  assert(files.has("~/orchestrator/graph-1/graph.yaml"));

  graph.nodes = [{
    schema: "orchestrator-node/v1",
    id: "node-a",
    type: "docker_container",
    name: "Web",
    x: 1,
    y: 2,
    config: {},
    runtime: {}
  }];
  graph.nodeIds = ["node-a"];
  await saveGraph(graph, runtime);

  const loaded = await readGraph("graph-1", runtime);
  assert.equal(loaded.title, "Ops");
  assert.equal(loaded.nodes.length, 1);
  assert.equal(loaded.nodes[0].id, "node-a");
});

test("listGraphs reads graph manifests", async () => {
  const { runtime } = createYamlRuntime();
  await createGraph({ title: "First" }, runtime);
  await createGraph({ title: "Second" }, runtime);

  const graphs = await listGraphs(runtime);
  assert.deepEqual(graphs.map((graph) => graph.title), ["First", "Second"]);
});
```

- [ ] **Step 2: Run the storage tests to verify they fail**

Run:

```bash
node --test tests/orchestrator_storage_test.mjs
```

Expected: FAIL because `storage.js` does not exist.

- [ ] **Step 3: Implement storage helpers**

Create `app/L0/_all/mod/_core/orchestrator/storage.js` with these exports:

```js
import {
  ORCHESTRATOR_GRAPH_FILE,
  ORCHESTRATOR_GRAPH_SCHEMA,
  ORCHESTRATOR_NODES_DIR,
  ORCHESTRATOR_NODE_SCHEMA,
  ORCHESTRATOR_ROOT_PATH
} from "./constants.js";
import { normalizeGraphIcon, normalizeGraphIconColor, normalizeGraphTitle } from "./graph-metadata.js";
import { normalizeNode } from "./node-types.js";

function ensureRuntime(runtime = globalThis.space) {
  if (!runtime?.api || !runtime?.utils?.yaml) {
    throw new Error("Orchestrator storage requires the authenticated Space runtime.");
  }
  return runtime;
}

export function buildGraphRootPath(graphId) {
  return `${ORCHESTRATOR_ROOT_PATH}${String(graphId).trim()}/`;
}

export function buildGraphManifestPath(graphId) {
  return `${buildGraphRootPath(graphId)}${ORCHESTRATOR_GRAPH_FILE}`;
}

export function buildNodePath(graphId, nodeId) {
  return `${buildGraphRootPath(graphId)}${ORCHESTRATOR_NODES_DIR}${String(nodeId).trim()}.yaml`;
}

export async function listGraphs(runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const response = await runtime.api.filePaths({ patterns: ["**/orchestrator/*/graph.yaml"] });
  const paths = (response.paths || []).map((entry) => entry.path || entry);
  const readResult = await runtime.api.fileRead({ files: paths.map((path) => ({ path })) });
  return (readResult.files || [])
    .map((file) => normalizeGraphManifest(runtime.utils.yaml.parse(file.content || "{}")))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function createGraph(options = {}, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const existing = await listGraphs(runtime).catch(() => []);
  const graph = normalizeGraphManifest({
    id: options.id || nextGraphId(existing),
    title: options.title,
    icon: options.icon,
    icon_color: options.icon_color,
    nodeIds: [],
    edges: []
  });
  await saveGraph({ ...graph, nodes: [] }, runtime);
  return graph;
}

export async function readGraph(graphId, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const manifestResponse = await runtime.api.fileRead(buildGraphManifestPath(graphId));
  const manifest = normalizeGraphManifest(runtime.utils.yaml.parse(manifestResponse.content || "{}"));
  const nodeFiles = manifest.nodeIds.map((nodeId) => ({ path: buildNodePath(manifest.id, nodeId) }));
  const nodeResult = nodeFiles.length ? await runtime.api.fileRead({ files: nodeFiles }) : { files: [] };
  const nodes = (nodeResult.files || []).map((file) => normalizeNode(runtime.utils.yaml.parse(file.content || "{}")));
  return { ...manifest, nodes };
}

export async function saveGraph(graph, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const manifest = normalizeGraphManifest({ ...graph, nodeIds: (graph.nodes || []).map((node) => node.id) });
  const files = [{
    path: buildGraphManifestPath(manifest.id),
    content: runtime.utils.yaml.stringify(stripGraphForManifest(manifest))
  }];

  for (const node of graph.nodes || []) {
    const normalizedNode = normalizeNode(node);
    files.push({
      path: buildNodePath(manifest.id, normalizedNode.id),
      content: runtime.utils.yaml.stringify(normalizedNode)
    });
  }

  await runtime.api.fileWrite({ files });
  return { ...manifest, nodes: (graph.nodes || []).map((node) => normalizeNode(node)) };
}

function normalizeGraphManifest(source = {}) {
  const now = new Date().toISOString();
  const id = String(source.id || "graph-1").trim();
  return {
    schema: ORCHESTRATOR_GRAPH_SCHEMA,
    id,
    title: normalizeGraphTitle(source.title),
    icon: normalizeGraphIcon(source.icon),
    icon_color: normalizeGraphIconColor(source.icon_color),
    nodeIds: Array.isArray(source.nodeIds) ? source.nodeIds.map(String).filter(Boolean) : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
    topology: source.topology && typeof source.topology === "object" ? source.topology : { dockerNetworkName: `orchestrator-${id}`, applyMode: "manual" },
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  };
}

function stripGraphForManifest(graph) {
  const { nodes, ...manifest } = graph;
  return manifest;
}

function nextGraphId(graphs) {
  const used = new Set(graphs.map((graph) => graph.id));
  let index = 1;
  while (used.has(`graph-${index}`)) index += 1;
  return `graph-${index}`;
}
```

- [ ] **Step 4: Run storage tests**

Run:

```bash
node --test tests/orchestrator_storage_test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/storage.js tests/orchestrator_storage_test.mjs
git commit -m "Add orchestrator storage"
```

---

### Task 5: Frontend API Clients And Credentials

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/credentials.js`
- Create: `app/L0/_all/mod/_core/orchestrator/docker-client.js`
- Create: `app/L0/_all/mod/_core/orchestrator/runner-client.js`
- Create: `app/L0/_all/mod/_core/orchestrator/agent-adapters.js`
- Test: `tests/orchestrator_clients_test.mjs`

- [ ] **Step 1: Write client tests**

Create `tests/orchestrator_clients_test.mjs`:

```js
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
```

- [ ] **Step 2: Run the client tests to verify they fail**

Run:

```bash
node --test tests/orchestrator_clients_test.mjs
```

Expected: FAIL because the client modules do not exist.

- [ ] **Step 3: Implement `credentials.js`**

Create `app/L0/_all/mod/_core/orchestrator/credentials.js`:

```js
import { ORCHESTRATOR_ROOT_PATH, ORCHESTRATOR_SECRETS_DIR } from "./constants.js";

function ensureRuntime(runtime = globalThis.space) {
  if (!runtime?.api || !runtime?.utils?.yaml || !runtime?.utils?.userCrypto) {
    throw new Error("Orchestrator credentials require app file, YAML, and userCrypto runtime helpers.");
  }
  return runtime;
}

export function buildCredentialPath(ref) {
  return `${ORCHESTRATOR_ROOT_PATH}${ORCHESTRATOR_SECRETS_DIR}${String(ref).trim()}.yaml`;
}

export async function writeCredential({ ref, provider, secret }, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const normalizedRef = String(ref || "").trim();
  const normalizedProvider = String(provider || "").trim();
  const normalizedSecret = String(secret || "");
  if (!normalizedRef || !normalizedProvider || !normalizedSecret) {
    throw new Error("Credential ref, provider, and secret are required.");
  }
  const encrypted = await runtime.utils.userCrypto.encryptText(normalizedSecret);
  return runtime.api.fileWrite({
    path: buildCredentialPath(normalizedRef),
    content: runtime.utils.yaml.stringify({ schema: "orchestrator-secret/v1", ref: normalizedRef, provider: normalizedProvider, encrypted })
  });
}

export async function decryptCredentialForRun(ref, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const response = await runtime.api.fileRead(buildCredentialPath(ref));
  const record = runtime.utils.yaml.parse(response.content || "{}");
  const secret = await runtime.utils.userCrypto.decryptText(record.encrypted || "");
  return { provider: String(record.provider || ""), secret };
}
```

- [ ] **Step 4: Implement `docker-client.js`**

Create `app/L0/_all/mod/_core/orchestrator/docker-client.js`:

```js
function ensureRuntime(runtime = globalThis.space) {
  if (!runtime?.api?.call) throw new Error("Docker client requires space.api.call.");
  return runtime;
}

export function createDockerClient(runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  return {
    list: () => runtime.api.call("docker_list"),
    inspect: (containerId) => runtime.api.call("docker_inspect", { query: { containerId } }),
    create: (definition) => runtime.api.call("docker_create", { method: "POST", body: definition }),
    start: (containerId) => runtime.api.call("docker_start", { method: "POST", body: { containerId } }),
    stop: (containerId) => runtime.api.call("docker_stop", { method: "POST", body: { containerId } }),
    restart: (containerId) => runtime.api.call("docker_restart", { method: "POST", body: { containerId } }),
    remove: (containerId, options = {}) => runtime.api.call("docker_remove", { method: "POST", body: { containerId, ...options } }),
    logs: (containerId, options = {}) => runtime.api.call("docker_logs", { query: { containerId, tail: options.tail || 100 } }),
    exec: (payload) => runtime.api.call("docker_exec", { method: "POST", body: payload }),
    networkCreate: (networkName) => runtime.api.call("docker_network_create", { method: "POST", body: { networkName } }),
    networkConnect: (networkName, containerId) => runtime.api.call("docker_network_connect", { method: "POST", body: { networkName, containerId } }),
    networkDisconnect: (networkName, containerId) => runtime.api.call("docker_network_disconnect", { method: "POST", body: { networkName, containerId } })
  };
}
```

- [ ] **Step 5: Implement `runner-client.js` and `agent-adapters.js`**

Create `app/L0/_all/mod/_core/orchestrator/runner-client.js`:

```js
function ensureRuntime(runtime = globalThis.space) {
  if (!runtime?.api?.call) throw new Error("Runner client requires space.api.call.");
  return runtime;
}

export function createRunnerClient(runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  return {
    start: (payload) => runtime.api.call("agent_run_start", { method: "POST", body: payload }),
    status: (runId) => runtime.api.call("agent_run_status", { query: { runId } }),
    stop: (runId) => runtime.api.call("agent_run_stop", { method: "POST", body: { runId } }),
    events: (runId) => runtime.api.call("agent_run_events", { query: { runId } })
  };
}
```

Create `app/L0/_all/mod/_core/orchestrator/agent-adapters.js`:

```js
const PROVIDER_BY_NODE_TYPE = Object.freeze({
  claude_agent: "anthropic",
  openai_agent: "openai",
  external_a2a_agent: "a2a",
  agent_zero: "agent_zero",
  space_agent: "space_agent"
});

export function getProviderForNode(node) {
  return PROVIDER_BY_NODE_TYPE[node?.type] || "";
}

export function buildRunRequest({ graphId, node, input, credential }) {
  const provider = getProviderForNode(node);
  if (!provider) {
    throw new Error(`Node type ${node?.type || "unknown"} does not support agent runs.`);
  }
  if (credential?.provider && credential.provider !== provider) {
    throw new Error(`Credential provider ${credential.provider} does not match ${provider}.`);
  }
  return {
    graphId: String(graphId || "").trim(),
    nodeId: String(node.id || "").trim(),
    provider,
    input: String(input || ""),
    node: {
      id: node.id,
      type: node.type,
      name: node.name,
      config: node.config || {},
      runtime: node.runtime || {}
    },
    credential: credential || null
  };
}
```

- [ ] **Step 6: Run client tests**

Run:

```bash
node --test tests/orchestrator_clients_test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/credentials.js app/L0/_all/mod/_core/orchestrator/docker-client.js app/L0/_all/mod/_core/orchestrator/runner-client.js app/L0/_all/mod/_core/orchestrator/agent-adapters.js tests/orchestrator_clients_test.mjs
git commit -m "Add orchestrator frontend clients"
```

---

### Task 6: Store And Runtime Namespace

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/store.js`
- Modify: `tests/orchestrator_clients_test.mjs`

- [ ] **Step 1: Add runtime namespace tests**

Append this test to `tests/orchestrator_clients_test.mjs`:

```js
test("installOrchestratorRuntimeNamespace exposes graph APIs", async () => {
  const previousSpace = globalThis.space;
  const { runtime } = createRuntime();
  globalThis.space = runtime;

  const { installOrchestratorRuntimeNamespace } = await import("../app/L0/_all/mod/_core/orchestrator/store.js?test=namespace");
  const namespace = installOrchestratorRuntimeNamespace({ activeStore: null });

  assert.equal(globalThis.space.orchestrator, namespace);
  assert.equal(typeof namespace.listGraphs, "function");
  assert.equal(typeof namespace.createGraph, "function");
  assert.equal(typeof namespace.addNode, "function");
  assert.equal(typeof namespace.addEdge, "function");

  globalThis.space = previousSpace;
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```bash
node --test tests/orchestrator_clients_test.mjs
```

Expected: FAIL because `store.js` does not exist.

- [ ] **Step 3: Implement store namespace exports**

Create `app/L0/_all/mod/_core/orchestrator/store.js` with this public namespace installer first:

```js
import { ORCHESTRATOR_ROUTE_PATH, ORCHESTRATOR_STORE_NAME } from "./constants.js";
import { normalizeEdge } from "./edges.js";
import { createDefaultNode } from "./node-types.js";
import { createGraph, listGraphs, readGraph, saveGraph } from "./storage.js";

let activeStore = null;

export function installOrchestratorRuntimeNamespace({ activeStore: suppliedStore = activeStore } = {}) {
  const runtime = globalThis.space;
  if (!runtime) throw new Error("Space runtime is not available.");

  const namespace = {
    async listGraphs() {
      return suppliedStore?.listGraphs ? suppliedStore.listGraphs() : listGraphs();
    },
    async createGraph(options = {}) {
      const graph = await createGraph(options);
      if (options.open !== false) {
        await namespace.openGraph(graph.id);
      }
      return graph;
    },
    openGraph(graphId) {
      if (!runtime.router) throw new Error("Router runtime is not available.");
      return runtime.router.goTo(ORCHESTRATOR_ROUTE_PATH, { params: { id: graphId } });
    },
    readGraph,
    async removeGraph() {
      throw new Error("Graph removal will be available after the graph page mounts.");
    },
    async addNode(options = {}) {
      if (!suppliedStore?.addNode) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.addNode(options);
    },
    async updateNode(options = {}) {
      if (!suppliedStore?.updateNode) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.updateNode(options);
    },
    async removeNode(options = {}) {
      if (!suppliedStore?.removeNode) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.removeNode(options);
    },
    async addEdge(options = {}) {
      if (!suppliedStore?.addEdge) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.addEdge(options);
    },
    async removeEdge(options = {}) {
      if (!suppliedStore?.removeEdge) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.removeEdge(options);
    },
    async applyTopology(graphId) {
      if (!suppliedStore?.applyTopology) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.applyTopology(graphId);
    },
    sendMessage(message) {
      if (!suppliedStore?.sendMessage) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.sendMessage(message);
    },
    async runAgentTask(options = {}) {
      if (!suppliedStore?.runAgentTask) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.runAgentTask(options);
    },
    async startContainer(nodeId) {
      if (!suppliedStore?.startContainer) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.startContainer(nodeId);
    },
    async stopContainer(nodeId) {
      if (!suppliedStore?.stopContainer) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.stopContainer(nodeId);
    },
    async restartContainer(nodeId) {
      if (!suppliedStore?.restartContainer) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.restartContainer(nodeId);
    },
    async getContainerLogs(nodeId) {
      if (!suppliedStore?.getContainerLogs) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.getContainerLogs(nodeId);
    },
    async execInContainer(options = {}) {
      if (!suppliedStore?.execInContainer) throw new Error("The orchestrator page is not mounted.");
      return suppliedStore.execInContainer(options);
    }
  };

  runtime.orchestrator = namespace;
  return namespace;
}
```

- [ ] **Step 4: Add the Alpine model below the namespace**

Append the page model and registration to `store.js`:

```js
function createOrchestratorPageModel() {
  return {
    graph: null,
    graphs: [],
    camera: { x: 0, y: 0, zoom: 1 },
    statusMessage: "",
    get hasGraph() {
      return Boolean(this.graph?.id);
    },
    get currentGraphContextTags() {
      return this.graph?.id ? `orchestrator:open orchestrator:id:${this.graph.id}` : "";
    },
    get nodesById() {
      return Object.fromEntries((this.graph?.nodes || []).map((node) => [node.id, node]));
    },
    async init() {
      activeStore = this;
      installOrchestratorRuntimeNamespace({ activeStore: this });
      await this.listGraphs();
      const graphId = globalThis.space?.router?.getParam?.("id") || this.graphs[0]?.id;
      if (graphId) {
        await this.openGraph(graphId);
      } else {
        this.graph = await createGraph({ title: "My Orchestration Graph" });
        await this.listGraphs();
      }
    },
    async listGraphs() {
      this.graphs = await listGraphs();
      return this.graphs;
    },
    async openGraph(graphId) {
      this.graph = await readGraph(graphId);
      return this.graph;
    },
    async persistGraph() {
      if (!this.graph) throw new Error("No graph is open.");
      this.graph = await saveGraph(this.graph);
      return this.graph;
    },
    async addNode(options = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      const node = createDefaultNode(options);
      this.graph.nodes = [...(this.graph.nodes || []), node];
      this.graph.nodeIds = this.graph.nodes.map((entry) => entry.id);
      await this.persistGraph();
      return node;
    },
    async updateNode({ nodeId, ...patch } = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      this.graph.nodes = (this.graph.nodes || []).map((node) => node.id === nodeId ? { ...node, ...patch } : node);
      await this.persistGraph();
      return this.graph.nodes.find((node) => node.id === nodeId);
    },
    async removeNode({ nodeId } = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      this.graph.nodes = (this.graph.nodes || []).filter((node) => node.id !== nodeId);
      this.graph.nodeIds = this.graph.nodes.map((node) => node.id);
      this.graph.edges = (this.graph.edges || []).filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      return this.persistGraph();
    },
    async addEdge(options = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      const edge = normalizeEdge(options, { nodesById: this.nodesById, existingEdges: this.graph.edges || [] });
      this.graph.edges = [...(this.graph.edges || []), edge];
      await this.persistGraph();
      return edge;
    },
    async removeEdge({ edgeId } = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      this.graph.edges = (this.graph.edges || []).filter((edge) => edge.id !== edgeId);
      return this.persistGraph();
    },
    async applyTopology() {
      this.statusMessage = "Topology application will call Docker endpoints after backend APIs are installed.";
      return { ok: true, status: this.statusMessage };
    },
    sendMessage(message) {
      return message;
    },
    async runAgentTask() {
      throw new Error("Runner endpoints are not installed yet.");
    },
    async startContainer() {
      throw new Error("Docker endpoints are not installed yet.");
    },
    async stopContainer() {
      throw new Error("Docker endpoints are not installed yet.");
    },
    async restartContainer() {
      throw new Error("Docker endpoints are not installed yet.");
    },
    async getContainerLogs() {
      throw new Error("Docker endpoints are not installed yet.");
    },
    async execInContainer() {
      throw new Error("Docker endpoints are not installed yet.");
    }
  };
}

if (globalThis.space?.fw?.createStore) {
  globalThis.space.fw.createStore(ORCHESTRATOR_STORE_NAME, createOrchestratorPageModel());
  installOrchestratorRuntimeNamespace({ activeStore: null });
}
```

- [ ] **Step 5: Run client tests**

Run:

```bash
node --test tests/orchestrator_clients_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/store.js tests/orchestrator_clients_test.mjs
git commit -m "Add orchestrator runtime namespace"
```

---

### Task 7: Routed Canvas UI

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/view.html`
- Create: `app/L0/_all/mod/_core/orchestrator/orchestrator.css`
- Modify: `app/L0/_all/mod/_core/router/router.css`

- [ ] **Step 1: Add the route full-bleed CSS override**

Modify `app/L0/_all/mod/_core/router/router.css` so every `spaces` full-bleed selector also includes `orchestrator`:

```css
.router-stage[data-route-path="spaces"],
.router-stage[data-route-path="orchestrator"] {
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

.router-stage-inner[data-route-path="spaces"],
.router-stage-inner[data-route-path="orchestrator"] {
  width: 100%;
  max-width: none;
  height: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
}

.router-stage-inner[data-route-path="spaces"] > .router-route-frame,
.router-stage-inner[data-route-path="spaces"] > .router-route-frame > .router-route-outlet,
.router-stage-inner[data-route-path="spaces"] > .router-route-frame > .router-route-outlet > .router-route-mount,
.router-stage-inner[data-route-path="orchestrator"] > .router-route-frame,
.router-stage-inner[data-route-path="orchestrator"] > .router-route-frame > .router-route-outlet,
.router-stage-inner[data-route-path="orchestrator"] > .router-route-frame > .router-route-outlet > .router-route-mount {
  height: 100%;
  min-height: 100%;
}
```

- [ ] **Step 2: Create the routed view**

Create `app/L0/_all/mod/_core/orchestrator/view.html`:

```html
<html>
  <head>
    <link rel="stylesheet" href="/mod/_core/orchestrator/orchestrator.css" />
    <script type="module" src="/mod/_core/orchestrator/store.js"></script>
  </head>
  <body>
    <div x-data class="orchestrator-root">
      <x-context :data-tags="$store.orchestratorPage?.currentGraphContextTags || ''"></x-context>

      <template x-inject='[id="_core/onscreen_menu/bar_start"]'>
        <div class="orchestrator-topbar-cluster" data-order="110">
          <button type="button" class="space-topbar-button space-topbar-button--icon" title="Back" aria-label="Back" @click="space.router?.back?.()">
            <x-icon>chevron_left</x-icon>
          </button>
          <span class="orchestrator-topbar-title" x-text="$store.orchestratorPage?.graph?.title || 'Orchestrator'"></span>
        </div>
      </template>

      <section class="orchestrator-shell" x-show="$store.orchestratorPage" x-cloak>
        <header class="orchestrator-toolbar">
          <button type="button" class="secondary-button" @click="void $store.orchestratorPage.addNode({ type: 'docker_container', x: 80, y: 80 })">
            <x-icon>deployed_code</x-icon>
            <span>Container</span>
          </button>
          <button type="button" class="secondary-button" @click="void $store.orchestratorPage.addNode({ type: 'openai_agent', x: 360, y: 120 })">
            <x-icon>smart_toy</x-icon>
            <span>Agent</span>
          </button>
          <button type="button" class="primary-button" @click="void $store.orchestratorPage.applyTopology()">
            <x-icon>account_tree</x-icon>
            <span>Apply Topology</span>
          </button>
          <p class="orchestrator-status" x-text="$store.orchestratorPage.statusMessage"></p>
        </header>

        <main class="orchestrator-canvas" x-ref="canvas">
          <svg class="orchestrator-edges" aria-hidden="true">
            <defs>
              <marker id="orchestrator-edge-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 9 3 L 0 6 z"></path>
              </marker>
            </defs>
          </svg>

          <div class="orchestrator-world">
            <template x-for="node in ($store.orchestratorPage.graph?.nodes || [])" :key="node.id">
              <article class="orchestrator-node" :data-node-type="node.type" :style="`transform: translate(${node.x}px, ${node.y}px)`">
                <button type="button" class="orchestrator-port orchestrator-port--input" title="Input port" aria-label="Input port"></button>
                <header class="orchestrator-node-header">
                  <x-icon x-text="node.type === 'docker_container' ? 'deployed_code' : 'smart_toy'"></x-icon>
                  <span x-text="node.name"></span>
                  <span class="orchestrator-node-status" :data-status="node.status || 'idle'"></span>
                </header>
                <div class="orchestrator-node-body">
                  <p x-text="node.type"></p>
                  <p x-text="node.config?.image || node.config?.model || node.config?.endpoint || 'Not configured'"></p>
                </div>
                <footer class="orchestrator-node-footer">
                  <button type="button" class="secondary-button">Logs</button>
                  <button type="button" class="secondary-button">Run</button>
                </footer>
                <button type="button" class="orchestrator-port orchestrator-port--output" title="Output port" aria-label="Output port"></button>
              </article>
            </template>
          </div>
        </main>
      </section>
    </div>
  </body>
</html>
```

- [ ] **Step 3: Add initial canvas CSS**

Create `app/L0/_all/mod/_core/orchestrator/orchestrator.css`:

```css
.orchestrator-root,
.orchestrator-shell {
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.orchestrator-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: #0a1220;
  color: var(--color-text);
  overflow: hidden;
}

.orchestrator-toolbar,
.orchestrator-topbar-cluster {
  display: flex;
  align-items: center;
  gap: 8px;
}

.orchestrator-toolbar {
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 18, 32, 0.88);
  backdrop-filter: blur(16px);
}

.orchestrator-status {
  margin: 0 0 0 auto;
  color: var(--color-text-muted);
  font-size: 0.84rem;
}

.orchestrator-canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  background:
    radial-gradient(circle at 20% 20%, rgba(74, 158, 255, 0.12), transparent 28rem),
    #0a1220;
}

.orchestrator-edges,
.orchestrator-world {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}

.orchestrator-edges {
  z-index: 1;
  overflow: visible;
  pointer-events: none;
}

.orchestrator-world {
  z-index: 2;
}

.orchestrator-node {
  position: absolute;
  width: 280px;
  min-height: 150px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(16, 27, 45, 0.95);
  overflow: visible;
}

.orchestrator-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  cursor: grab;
}

.orchestrator-node-status {
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-radius: 999px;
  background: #6b7280;
}

.orchestrator-node-status[data-status="running"] {
  background: #22c55e;
}

.orchestrator-node-status[data-status="error"] {
  background: #ef4444;
}

.orchestrator-node-body {
  padding: 12px 16px;
}

.orchestrator-node-body p {
  margin: 0 0 4px;
  overflow-wrap: anywhere;
}

.orchestrator-node-footer {
  display: flex;
  gap: 8px;
  padding: 0 16px 14px;
}

.orchestrator-port {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  padding: 0;
  border: 1px solid rgba(74, 158, 255, 1);
  border-radius: 50%;
  background: rgba(74, 158, 255, 0.6);
  transform: translateY(-50%);
  cursor: crosshair;
}

.orchestrator-port:hover,
.orchestrator-port:focus-visible {
  background: rgba(74, 158, 255, 1);
  outline: 2px solid rgba(74, 158, 255, 0.25);
}

.orchestrator-port--input {
  left: -6px;
}

.orchestrator-port--output {
  right: -6px;
}
```

- [ ] **Step 4: Smoke-check syntax**

Run:

```bash
node --check app/L0/_all/mod/_core/orchestrator/store.js
node --test tests/orchestrator_model_test.mjs tests/orchestrator_storage_test.mjs tests/orchestrator_clients_test.mjs
```

Expected: all checks PASS.

- [ ] **Step 5: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/view.html app/L0/_all/mod/_core/orchestrator/orchestrator.css app/L0/_all/mod/_core/router/router.css
git commit -m "Add orchestrator routed canvas"
```

---

### Task 8: Dashboard, Menu, And Skill Extensions

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/content_middle/orchestrator-dashboard-launcher.html`
- Create: `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/topbar_primary/new-graph.html`
- Create: `app/L0/_all/mod/_core/orchestrator/ext/html/_core/onscreen_menu/items/orchestrator.html`
- Create: `app/L0/_all/mod/_core/orchestrator/ext/skills/orchestrator/SKILL.md`

- [ ] **Step 1: Create dashboard and menu adapters**

Create `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/content_middle/orchestrator-dashboard-launcher.html`:

```html
<section class="space-panel">
  <div>
    <p class="page-eyebrow">Orchestrator</p>
    <h2>Agent and container graphs</h2>
    <p class="field-note">Build Docker and agent topologies that can run while this graph is open.</p>
  </div>
  <button type="button" class="primary-button" @click="void space.orchestrator?.createGraph?.({ open: true })">
    <x-icon>account_tree</x-icon>
    <span>New Graph</span>
  </button>
</section>
```

Create `app/L0/_all/mod/_core/orchestrator/ext/html/_core/dashboard/topbar_primary/new-graph.html`:

```html
<button type="button" class="space-topbar-button" data-order="240" @click="void space.orchestrator?.createGraph?.({ open: true })">
  <x-icon>account_tree</x-icon>
  <span>New Graph</span>
</button>
```

Create `app/L0/_all/mod/_core/orchestrator/ext/html/_core/onscreen_menu/items/orchestrator.html`:

```html
<button type="button" data-order="300" @click="void space.router?.goTo?.('orchestrator')">
  <x-icon>account_tree</x-icon>
  <span>Orchestrator</span>
</button>
```

- [ ] **Step 2: Create the Orchestrator skill**

Create `app/L0/_all/mod/_core/orchestrator/ext/skills/orchestrator/SKILL.md`:

```markdown
---
metadata:
  when:
    tags: [orchestrator:open]
  loaded:
    tags: [orchestrator:open]
  placement: transient
---

# Orchestrator Skill

You are operating inside the Orchestrator canvas. The current graph topology is available through `space.orchestrator`.

Use `space.orchestrator` for graph edits and runs:

- `await space.orchestrator.listGraphs()`
- `await space.orchestrator.createGraph({ title: "..." })`
- `await space.orchestrator.addNode({ type: "docker_container", name: "...", x: 0, y: 0, config: { image: "nginx", tag: "latest" } })`
- `await space.orchestrator.addNode({ type: "openai_agent", name: "...", x: 320, y: 0, runtime: { credentialRef: "openai-main" } })`
- `await space.orchestrator.addEdge({ source: "node-a", target: "node-b" })`
- `await space.orchestrator.applyTopology()`
- `await space.orchestrator.runAgentTask({ nodeId: "node-a", input: "..." })`
- `await space.orchestrator.startContainer("node-id")`
- `await space.orchestrator.stopContainer("node-id")`
- `await space.orchestrator.getContainerLogs("node-id")`

Edge behavior:

- container to container edges create Docker network topology.
- agent to container edges allow container control.
- container to agent edges provide monitor/log context.
- agent to agent edges allow delegation.
- agent to agent edges with `protocol: "a2a"` use the A2A adapter when the target supports it.

Provider credentials are referenced by `credentialRef`; do not write provider secrets into graph or node YAML.

Always finish execution with a short plain-text summary of what changed or what failed.
```

- [ ] **Step 3: Verify extension files are discoverable paths**

Run:

```bash
find app/L0/_all/mod/_core/orchestrator/ext -type f | sort
```

Expected output includes all four extension/skill files.

- [ ] **Step 4: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/ext
git commit -m "Add orchestrator extension surfaces"
```

---

### Task 9: Docker Server Helper

**Files:**
- Create: `server/lib/docker/AGENTS.md`
- Create: `server/lib/docker/client.js`
- Test: `tests/docker_service_test.mjs`

- [ ] **Step 1: Write Docker helper tests**

Create `tests/docker_service_test.mjs`:

```js
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
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
node --test tests/docker_service_test.mjs
```

Expected: FAIL because `server/lib/docker/client.js` does not exist.

- [ ] **Step 3: Implement Docker helper**

Create `server/lib/docker/client.js`:

```js
import Docker from "dockerode";

const MANAGED_LABEL_PREFIX = "space.orchestrator.";

export function resolveDockerOptions(runtimeParams) {
  const host = String(runtimeParams?.get?.("DOCKER_HOST", "") || "").trim();
  if (!host) {
    return { socketPath: "/var/run/docker.sock" };
  }
  if (host.startsWith("tcp://")) {
    const url = new URL(host);
    return { host: url.hostname, port: url.port, protocol: url.protocol.replace(":", "") === "https" ? "https" : "http" };
  }
  if (host.startsWith("unix://")) {
    return { socketPath: host.replace(/^unix:\/\//u, "") };
  }
  return { socketPath: host };
}

export function createDockerClient(runtimeParams) {
  return new Docker(resolveDockerOptions(runtimeParams));
}

export function assertAdmin(context) {
  const groups = context.user?.groups || [];
  if (!groups.includes("_admin")) {
    const error = new Error("Docker mutation requires _admin membership.");
    error.statusCode = 403;
    throw error;
  }
}

export function normalizeContainerSummary(container) {
  const labels = container.Labels || {};
  return {
    id: String(container.Id || ""),
    name: String(container.Names?.[0] || container.Name || "").replace(/^\//u, ""),
    image: String(container.Image || ""),
    state: String(container.State || ""),
    status: String(container.Status || ""),
    ports: (container.Ports || []).map((port) => ({
      host: port.PublicPort || null,
      container: port.PrivatePort || null,
      type: port.Type || "tcp"
    })),
    labels,
    managed: Object.keys(labels).some((key) => key.startsWith(MANAGED_LABEL_PREFIX))
  };
}

export function createDockerService({ docker }) {
  return {
    async list() {
      const containers = await docker.listContainers({ all: true });
      return containers.map(normalizeContainerSummary);
    },
    async inspect(containerId) {
      return docker.getContainer(containerId).inspect();
    },
    async create(definition) {
      const container = await docker.createContainer(buildCreateOptions(definition));
      return container.inspect();
    },
    async start(containerId) {
      await docker.getContainer(containerId).start();
      return { ok: true, containerId };
    },
    async stop(containerId) {
      await docker.getContainer(containerId).stop();
      return { ok: true, containerId };
    },
    async restart(containerId) {
      await docker.getContainer(containerId).restart();
      return { ok: true, containerId };
    },
    async remove(containerId) {
      await docker.getContainer(containerId).remove({ force: true });
      return { ok: true, containerId };
    },
    async logs(containerId, { tail = 100 } = {}) {
      const output = await docker.getContainer(containerId).logs({ stdout: true, stderr: true, tail, timestamps: false });
      return Buffer.isBuffer(output) ? output.toString("utf8").slice(-65536) : String(output || "").slice(-65536);
    },
    async exec({ containerId, command }) {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({ Cmd: Array.isArray(command) ? command : ["sh", "-lc", String(command || "")], AttachStdout: true, AttachStderr: true });
      const stream = await exec.start({ hijack: true, stdin: false });
      return { ok: true, output: String(stream || "").slice(-65536) };
    },
    async networkCreate(networkName) {
      await docker.createNetwork({ Name: networkName, Driver: "bridge" });
      return { ok: true, networkName };
    },
    async networkConnect(networkName, containerId) {
      await docker.getNetwork(networkName).connect({ Container: containerId });
      return { ok: true, networkName, containerId };
    },
    async networkDisconnect(networkName, containerId) {
      await docker.getNetwork(networkName).disconnect({ Container: containerId, Force: true });
      return { ok: true, networkName, containerId };
    }
  };
}

export function createDockerServiceFromContext(context) {
  return createDockerService({ docker: createDockerClient(context.runtimeParams) });
}

function buildCreateOptions(definition = {}) {
  const graphId = String(definition.graphId || "").trim();
  const nodeId = String(definition.nodeId || "").trim();
  return {
    Image: `${definition.image || "nginx"}:${definition.tag || "latest"}`,
    name: definition.name || undefined,
    Cmd: definition.command ? ["sh", "-lc", definition.command] : undefined,
    Env: (definition.environment || []).map(({ key, value }) => `${key}=${value}`),
    Labels: {
      "space.orchestrator.managed": "true",
      "space.orchestrator.graph": graphId,
      "space.orchestrator.node": nodeId
    },
    HostConfig: {
      PortBindings: Object.fromEntries((definition.ports || []).map((port) => [`${port.container}/tcp`, [{ HostPort: String(port.host) }]])),
      Binds: (definition.volumes || []).map((volume) => `${volume.host}:${volume.container}`)
    }
  };
}
```

- [ ] **Step 4: Add Docker helper docs**

Create `server/lib/docker/AGENTS.md`:

```markdown
# AGENTS

## Purpose

`server/lib/docker/` owns Docker client setup and Docker operation helpers used by Orchestrator API endpoints.

## Ownership

- `client.js` resolves `DOCKER_HOST`, creates the Docker client, normalizes container summaries, checks `_admin` mutation permission, and exposes the Docker service methods.

## Contracts

- Browser code never accesses the Docker socket directly.
- API endpoints stay thin and delegate Docker behavior to this helper.
- Mutating container creation, removal, exec, and network operations require `_admin`.
- Managed containers are identified by `space.orchestrator.*` labels.
- Logs and exec output are bounded before they return to the browser.

## Development Guidance

Keep Docker policy here instead of duplicating it in endpoint files.
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
node --test tests/docker_service_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/docker tests/docker_service_test.mjs
git commit -m "Add orchestrator Docker service"
```

---

### Task 10: Docker API Endpoints

**Files:**
- Create all `server/api/docker_*.js` files listed in the file structure.
- Modify: `server/api/AGENTS.md`
- Test: `tests/docker_service_test.mjs`

- [ ] **Step 1: Add endpoint handler tests**

Append to `tests/docker_service_test.mjs`:

```js
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
```

- [ ] **Step 2: Run endpoint tests to verify failure**

Run:

```bash
node --test tests/docker_service_test.mjs
```

Expected: FAIL because endpoint files do not exist.

- [ ] **Step 3: Create simple endpoint pattern**

For each endpoint, import `assertAdmin` and `createDockerServiceFromContext`. Use this exact `docker_start.js` shape:

```js
import { createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  const containerId = String(context.body?.containerId || "").trim();
  if (!containerId) {
    const error = new Error("containerId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).start(containerId);
}
```

Create matching endpoint files:

- `docker_list.js`: `export async function get(context) { return getService(context).list(); }`
- `docker_inspect.js`: GET `containerId` from `context.query.containerId || context.body.containerId`
- `docker_create.js`: POST, call `assertAdmin(context)`, then `service.create(context.body)`
- `docker_stop.js`: POST, same validation as start, call `service.stop(containerId)`
- `docker_restart.js`: POST, call `service.restart(containerId)`
- `docker_remove.js`: POST, call `assertAdmin(context)`, then `service.remove(containerId)`
- `docker_logs.js`: GET, call `service.logs(containerId, { tail })`
- `docker_exec.js`: POST, call `assertAdmin(context)`, then `service.exec({ containerId, command })`
- `docker_network_create.js`: POST admin, require `networkName`, call `service.networkCreate(networkName)`
- `docker_network_connect.js`: POST admin, require `networkName` and `containerId`, call `service.networkConnect(networkName, containerId)`
- `docker_network_disconnect.js`: POST admin, require `networkName` and `containerId`, call `service.networkDisconnect(networkName, containerId)`

Each endpoint should throw a `400` error for missing required inputs.

- [ ] **Step 4: Document endpoint family**

Add a Docker endpoint family section to `server/api/AGENTS.md`:

```markdown
Docker endpoints:

- `docker_list`, `docker_inspect`, `docker_logs`, `docker_start`, `docker_stop`, and `docker_restart` expose authenticated Docker container inspection and lifecycle helpers for Orchestrator.
- `docker_create`, `docker_remove`, `docker_exec`, `docker_network_create`, `docker_network_connect`, and `docker_network_disconnect` require `_admin` because they mutate local container state or execute code.
- All Docker behavior delegates to `server/lib/docker/client.js`; endpoint files validate request shape only.
```

- [ ] **Step 5: Run Docker tests**

Run:

```bash
node --test tests/docker_service_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/api/docker_*.js server/api/AGENTS.md tests/docker_service_test.mjs
git commit -m "Add orchestrator Docker APIs"
```

---

### Task 11: Agent Runner Service

**Files:**
- Create: `server/lib/agent_runners/AGENTS.md`
- Create: `server/lib/agent_runners/claude.js`
- Create: `server/lib/agent_runners/openai.js`
- Create: `server/lib/agent_runners/a2a.js`
- Create: `server/lib/agent_runners/service.js`
- Test: `tests/agent_runner_service_test.mjs`

- [ ] **Step 1: Write runner tests with mocked adapters**

Create `tests/agent_runner_service_test.mjs`:

```js
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
  assert.throws(() => normalizeRunRequest({ provider: "openai", credential: { provider: "anthropic", secret: "sk" } }), /Credential provider/u);
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
```

- [ ] **Step 2: Run runner tests to verify failure**

Run:

```bash
node --test tests/agent_runner_service_test.mjs
```

Expected: FAIL because runner service modules do not exist.

- [ ] **Step 3: Implement normalized service**

Create `server/lib/agent_runners/service.js`:

```js
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
  if ((provider === "openai" || provider === "anthropic") && (!credential?.secret || credential.provider !== provider)) {
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
    credential: source.credential ? { provider: source.credential.provider, secret: "[redacted]" } : null
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
          EVENTS.get(run.id).push({ ...event, runId: run.id, createdAt: new Date().toISOString() });
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
```

- [ ] **Step 4: Implement provider adapters**

Create `server/lib/agent_runners/claude.js`:

```js
export async function* runClaudeAgent(request) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = request.credential.secret;
  try {
    const stream = query({
      prompt: request.input,
      options: {
        model: request.node.config?.model,
        allowedTools: request.node.config?.allowedTools || [],
        permissionMode: request.node.config?.permissionMode || "default",
        maxTurns: request.node.config?.maxTurns || 8
      }
    });
    for await (const message of stream) {
      yield { type: "provider_event", provider: "anthropic", payload: message };
    }
  } finally {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
}
```

Create `server/lib/agent_runners/openai.js`:

```js
export async function* runOpenAIAgent(request) {
  const { Agent, run, setDefaultOpenAIKey } = await import("@openai/agents");
  if (typeof setDefaultOpenAIKey === "function") {
    setDefaultOpenAIKey(request.credential.secret);
  } else {
    process.env.OPENAI_API_KEY = request.credential.secret;
  }
  const agent = new Agent({
    name: request.node.name || "Orchestrator Agent",
    instructions: request.node.config?.instructions || "",
    model: request.node.config?.model || "gpt-5.4"
  });
  const result = await run(agent, request.input);
  yield { type: "result", provider: "openai", payload: { finalOutput: result.finalOutput || "" } };
}
```

Create `server/lib/agent_runners/a2a.js`:

```js
export async function* forwardA2ATask(request) {
  const endpoint = String(request.node.config?.endpoint || "").trim();
  if (!endpoint) {
    const error = new Error("A2A endpoint is required.");
    error.statusCode = 400;
    throw error;
  }
  const url = new URL(endpoint);
  if (!["https:", "http:"].includes(url.protocol)) {
    const error = new Error("A2A endpoint must be HTTP or HTTPS.");
    error.statusCode = 400;
    throw error;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: request.input, graphId: request.graphId, nodeId: request.nodeId })
  });
  const payload = await response.json().catch(() => ({ text: "" }));
  yield { type: "result", provider: "a2a", payload };
}
```

- [ ] **Step 5: Add runner helper docs**

Create `server/lib/agent_runners/AGENTS.md`:

```markdown
# AGENTS

## Purpose

`server/lib/agent_runners/` owns Orchestrator's server-side agent execution adapters.

## Ownership

- `service.js` validates normalized run requests, records in-memory run state, and dispatches provider adapters.
- `claude.js` adapts Claude Agent SDK.
- `openai.js` adapts OpenAI Agents SDK.
- `a2a.js` forwards compatible A2A tasks.

## Contracts

- Credentials arrive per run and are never written to disk.
- Provider events are normalized before reaching the graph runtime.
- Runner state is in-memory and supports graph-open activity, not browser-closed daemon orchestration.

## Development Guidance

Keep provider-specific SDK details in adapter files. Keep endpoint files thin.
```

- [ ] **Step 6: Run runner tests**

Run:

```bash
node --test tests/agent_runner_service_test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/lib/agent_runners tests/agent_runner_service_test.mjs
git commit -m "Add orchestrator agent runner service"
```

---

### Task 12: Agent Runner API Endpoints

**Files:**
- Create: `server/api/agent_run_start.js`
- Create: `server/api/agent_run_status.js`
- Create: `server/api/agent_run_stop.js`
- Create: `server/api/agent_run_events.js`
- Modify: `server/api/AGENTS.md`
- Modify: `tests/agent_runner_service_test.mjs`

- [ ] **Step 1: Add endpoint tests**

Append to `tests/agent_runner_service_test.mjs`:

```js
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
```

- [ ] **Step 2: Run runner tests to verify failure**

Run:

```bash
node --test tests/agent_runner_service_test.mjs
```

Expected: FAIL because endpoint files do not exist.

- [ ] **Step 3: Implement runner endpoints**

Create `server/api/agent_run_start.js`:

```js
import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function post(context) {
  return getService(context).start(context.body || {});
}
```

Create `server/api/agent_run_status.js`:

```js
import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function get(context) {
  const runId = String(context.query?.runId || "").trim();
  if (!runId) {
    const error = new Error("runId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).status(runId);
}
```

Create `server/api/agent_run_stop.js`:

```js
import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function post(context) {
  const runId = String(context.body?.runId || "").trim();
  if (!runId) {
    const error = new Error("runId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).stop(runId);
}
```

Create `server/api/agent_run_events.js`:

```js
import { getSharedRunnerService } from "../lib/agent_runners/service.js";

function getService(context) {
  return context.runnerService || getSharedRunnerService();
}

export async function get(context) {
  const runId = String(context.query?.runId || "").trim();
  if (!runId) {
    const error = new Error("runId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).events(runId);
}
```

- [ ] **Step 4: Document runner endpoints**

Add this to `server/api/AGENTS.md`:

```markdown
Agent runner endpoints:

- `agent_run_start`, `agent_run_status`, `agent_run_stop`, and `agent_run_events` expose Orchestrator's graph-open SDK runner contract.
- Credentials are supplied per run by the authenticated browser and must not be written to disk.
- Endpoint files delegate to `server/lib/agent_runners/service.js`.
```

- [ ] **Step 5: Run runner tests**

Run:

```bash
node --test tests/agent_runner_service_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/api/agent_run_*.js server/api/AGENTS.md tests/agent_runner_service_test.mjs
git commit -m "Add orchestrator runner APIs"
```

---

### Task 13: Wire Store To Docker, Runners, Canvas, And Edges

**Files:**
- Modify: `app/L0/_all/mod/_core/orchestrator/store.js`
- Modify: `app/L0/_all/mod/_core/orchestrator/view.html`
- Modify: `app/L0/_all/mod/_core/orchestrator/orchestrator.css`
- Modify: `tests/orchestrator_clients_test.mjs`

- [ ] **Step 1: Add store behavior tests**

Append to `tests/orchestrator_clients_test.mjs`:

```js
test("store applyTopology calls docker client for network edges", async () => {
  const { createOrchestratorPageModel } = await import("../app/L0/_all/mod/_core/orchestrator/store.js?test=model");
  const calls = [];
  const store = createOrchestratorPageModel({
    dockerClient: {
      networkCreate: async (name) => calls.push(["networkCreate", name]),
      networkConnect: async (name, id) => calls.push(["networkConnect", name, id])
    }
  });
  store.graph = {
    id: "graph-1",
    topology: { dockerNetworkName: "orchestrator-graph-1" },
    nodes: [
      { id: "node-a", type: "docker_container", runtime: { containerId: "a" } },
      { id: "node-b", type: "docker_container", runtime: { containerId: "b" } }
    ],
    edges: [{ source: "node-a", target: "node-b", type: "network" }]
  };

  await store.applyTopology();
  assert.deepEqual(calls, [
    ["networkCreate", "orchestrator-graph-1"],
    ["networkConnect", "orchestrator-graph-1", "a"],
    ["networkConnect", "orchestrator-graph-1", "b"]
  ]);
});
```

- [ ] **Step 2: Run client tests to verify failure**

Run:

```bash
node --test tests/orchestrator_clients_test.mjs
```

Expected: FAIL because `createOrchestratorPageModel` is not exported with dependency injection and `applyTopology` is not wired.

- [ ] **Step 3: Export injectable model and wire clients**

Update `store.js`:

- Export `createOrchestratorPageModel(deps = {})`.
- Build default clients with `createDockerClient()` and `createRunnerClient()`.
- Implement `applyTopology()` to create the graph network and connect both container endpoints for every `network` edge.
- Implement `startContainer`, `stopContainer`, `restartContainer`, `getContainerLogs`, and `execInContainer` through `dockerClient`.
- Implement `runAgentTask` by decrypting credential, building run request, and calling `runnerClient.start`.

Use this `applyTopology` body:

```js
async applyTopology() {
  if (!this.graph) throw new Error("No graph is open.");
  const networkName = this.graph.topology?.dockerNetworkName || `orchestrator-${this.graph.id}`;
  const connected = new Set();
  await this.dockerClient.networkCreate(networkName).catch((error) => {
    if (!/already exists/i.test(error.message || "")) throw error;
  });
  for (const edge of this.graph.edges || []) {
    if (edge.type !== "network") continue;
    for (const nodeId of [edge.source, edge.target]) {
      const node = this.nodesById[nodeId];
      const containerId = node?.runtime?.containerId || node?.config?.containerId;
      if (containerId && !connected.has(containerId)) {
        await this.dockerClient.networkConnect(networkName, containerId);
        connected.add(containerId);
      }
    }
  }
  this.statusMessage = `Applied ${connected.size} container network connection${connected.size === 1 ? "" : "s"}.`;
  return { ok: true, connected: connected.size };
}
```

- [ ] **Step 4: Add canvas event bindings**

Update `view.html` and `store.js` so:

- canvas background pointerdown starts pan
- wheel zoom calls `createZoomedCamera`
- node header pointerdown starts node drag
- port clicks use `addEdge`
- SVG paths render current edges

Use these view bindings on the canvas:

```html
<main
  class="orchestrator-canvas"
  x-ref="canvas"
  @pointerdown="$store.orchestratorPage.handleCanvasPointerDown($event)"
  @pointermove.window="$store.orchestratorPage.handlePointerMove($event)"
  @pointerup.window="$store.orchestratorPage.handlePointerUp($event)"
  @wheel.prevent="$store.orchestratorPage.handleWheel($event)"
>
```

Use this world transform binding:

```html
:style="`transform: translate(${$store.orchestratorPage.camera.x}px, ${$store.orchestratorPage.camera.y}px) scale(${$store.orchestratorPage.camera.zoom})`"
```

- [ ] **Step 5: Run focused tests and syntax checks**

Run:

```bash
node --check app/L0/_all/mod/_core/orchestrator/store.js
node --test tests/orchestrator_clients_test.mjs tests/orchestrator_model_test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/L0/_all/mod/_core/orchestrator/store.js app/L0/_all/mod/_core/orchestrator/view.html app/L0/_all/mod/_core/orchestrator/orchestrator.css tests/orchestrator_clients_test.mjs
git commit -m "Wire orchestrator graph runtime"
```

---

### Task 14: Documentation Contracts

**Files:**
- Create: `app/L0/_all/mod/_core/orchestrator/AGENTS.md`
- Modify: `AGENTS.md`
- Modify: `app/AGENTS.md`
- Modify: `server/AGENTS.md`
- Modify: `commands/AGENTS.md`
- Modify: `tests/AGENTS.md`
- Modify: `app/L0/_all/mod/_core/documentation/docs/app/modules-and-extensions.md`
- Modify: `app/L0/_all/mod/_core/documentation/docs/app/runtime-and-layers.md`
- Modify: `app/L0/_all/mod/_core/documentation/docs/server/api/modules-and-runtime.md`
- Modify: `app/L0/_all/mod/_core/documentation/docs/cli/commands-and-runtime-params.md`
- Modify if needed: `app/L0/_all/mod/_core/documentation/ext/skills/documentation/SKILL.md`

- [ ] **Step 1: Create local module AGENTS doc**

Create `app/L0/_all/mod/_core/orchestrator/AGENTS.md`:

```markdown
# AGENTS

## Purpose

`_core/orchestrator/` owns the first-party graph orchestration surface for Docker containers and AI agents.

It provides a routed infinite canvas, graph/node/edge persistence under `~/orchestrator/`, a graph-open message bus, frontend clients for backend Docker and runner APIs, and the `space.orchestrator` runtime namespace.

## Ownership

- `view.html` owns the routed graph DOM, canvas anchors, topbar injection, and Alpine bindings.
- `orchestrator.css` owns graph-specific canvas, node, edge, port, and toolbar styling.
- `store.js` owns `$store.orchestratorPage`, mounted graph lifecycle, runtime namespace methods, topology application, and browser-side orchestration.
- `storage.js` owns all `~/orchestrator/` YAML persistence.
- `canvas.js` owns camera math, coordinate transforms, pan, zoom, and drag helpers.
- `node-types.js` owns node defaults, node categories, type-specific config, and normalization.
- `edges.js` owns edge typing, duplicate/self-loop rejection, edge colors, and Bezier path helpers.
- `message-bus.js` owns graph-open typed message routing.
- `credentials.js` owns encrypted credential record helpers.
- `docker-client.js` owns browser calls to Docker endpoints.
- `runner-client.js` owns browser calls to agent-run endpoints.
- `agent-adapters.js` owns browser-side run request shaping.
- `ext/html/` owns dashboard and onscreen-menu entry points.
- `ext/skills/orchestrator/SKILL.md` owns agent guidance while an Orchestrator graph is open.

## Persistence Contract

Graphs persist under `~/orchestrator/<graphId>/`:

- `graph.yaml` stores graph metadata, node ids, edges, topology settings, and timestamps.
- `nodes/<nodeId>.yaml` stores one normalized node record.
- `runs/<runId>.yaml` and `messages/<date>.yaml` store compact graph-open activity records.

Encrypted credentials live under `~/orchestrator/secrets/` and are referenced by `credentialRef`. Provider secrets must not be written into graph or node YAML.

## Runtime Namespace

`space.orchestrator` exposes graph CRUD, node/edge mutation, topology application, graph-open messaging, agent runs, and Docker node controls. Methods default to the mounted graph when a graph is open and throw clear errors when no graph context is available.

## Edge Semantics

- container to container: Docker network topology.
- agent to container: control permission.
- container to agent: monitor/log context.
- agent to agent: delegation.
- agent to agent with `protocol: a2a`: delegation through the A2A adapter.

## Development Guidance

Keep graph state and UI behavior in this module. Keep Docker socket access and SDK execution in server helpers. Use `space.api` for I/O, `space.utils.yaml` for YAML, and `_core/visual` primitives for shared chrome.
```

- [ ] **Step 2: Update parent and supplemental docs**

Make these explicit doc updates:

- Add `/app/L0/_all/mod/_core/orchestrator/AGENTS.md`, `/server/lib/docker/AGENTS.md`, and `/server/lib/agent_runners/AGENTS.md` to root `AGENTS.md`.
- Add Orchestrator to `app/AGENTS.md` module-local docs and major module owners.
- Add Docker and agent runner helper ownership to `server/AGENTS.md`.
- Add `DOCKER_HOST` to `commands/AGENTS.md`.
- Add Orchestrator tests to `tests/AGENTS.md`.
- Add a short Orchestrator section to `app/L0/_all/mod/_core/documentation/docs/app/modules-and-extensions.md`.
- Add `~/orchestrator/` to `app/L0/_all/mod/_core/documentation/docs/app/runtime-and-layers.md`.
- Add Docker and runner API families to `app/L0/_all/mod/_core/documentation/docs/server/api/modules-and-runtime.md`.
- Add `DOCKER_HOST` to `app/L0/_all/mod/_core/documentation/docs/cli/commands-and-runtime-params.md`.
- Update the documentation skill only if its docs map enumerates these files directly.

- [ ] **Step 3: Run documentation grep checks**

Run:

```bash
rg -n "orchestrator|DOCKER_HOST|agent_run|docker_" AGENTS.md app/AGENTS.md server/AGENTS.md commands/AGENTS.md tests/AGENTS.md app/L0/_all/mod/_core/documentation/docs
```

Expected: output shows Orchestrator docs, Docker/runner API docs, and `DOCKER_HOST` docs in the listed files.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md app/AGENTS.md server/AGENTS.md commands/AGENTS.md tests/AGENTS.md app/L0/_all/mod/_core/orchestrator/AGENTS.md app/L0/_all/mod/_core/documentation/docs app/L0/_all/mod/_core/documentation/ext/skills/documentation/SKILL.md
git add server/lib/docker/AGENTS.md server/lib/agent_runners/AGENTS.md
git commit -m "Document orchestrator contracts"
```

---

### Task 15: Full Verification And Browser Check

**Files:**
- No new source files expected.
- May modify files only to fix failures found by the checks below.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
node --test \
  tests/orchestrator_model_test.mjs \
  tests/orchestrator_storage_test.mjs \
  tests/orchestrator_clients_test.mjs \
  tests/docker_service_test.mjs \
  tests/agent_runner_service_test.mjs \
  tests/set_command_test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks for new modules**

Run:

```bash
node --check app/L0/_all/mod/_core/orchestrator/store.js
node --check app/L0/_all/mod/_core/orchestrator/storage.js
node --check app/L0/_all/mod/_core/orchestrator/node-types.js
node --check server/lib/docker/client.js
node --check server/lib/agent_runners/service.js
node --check server/lib/agent_runners/claude.js
node --check server/lib/agent_runners/openai.js
```

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected: server starts and prints the local URL. Keep it running for the browser check.

- [ ] **Step 4: Browser manual check**

Open the dev URL and navigate to:

```text
#/orchestrator
```

Verify:

- the route mounts without a router error card
- the canvas is nonblank
- toolbar buttons are visible and text fits
- Add Container creates a node
- Add Agent creates a node
- node cards do not overlap the toolbar
- ports are visible
- panning and zooming do not create native scrollbars
- reloading keeps the graph from `~/orchestrator/`
- missing Docker or credentials show visible recoverable status, not a silent failure

- [ ] **Step 5: Stop dev server**

Stop the server with `Ctrl-C`.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git diff --check
```

Expected: no whitespace errors. `git status --short` should only show intended files before the final commit.

- [ ] **Step 7: Commit fixes if verification changed files**

```bash
git add app server commands tests package.json package-lock.json AGENTS.md docs app/L0/_all/mod/_core/documentation
git commit -m "Verify orchestrator implementation"
```

Skip this commit only if Step 1 through Step 6 required no file changes.

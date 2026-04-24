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

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

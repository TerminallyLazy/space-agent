import {
  ORCHESTRATOR_GRAPH_FILE,
  ORCHESTRATOR_GRAPH_SCHEMA,
  ORCHESTRATOR_NODES_DIR,
  ORCHESTRATOR_ROOT_PATH
} from "./constants.js";
import {
  normalizeGraphIcon,
  normalizeGraphIconColor,
  normalizeGraphTitle
} from "./graph-metadata.js";
import { normalizeNode } from "./node-types.js";

const GRAPH_MANIFEST_PATTERN = "**/graph.yaml";
const GRAPH_PATH_MATCHER = /(?:^~|^L2\/[^/]+)\/orchestrator\/([^/]+)\/graph\.yaml$/u;

export function buildGraphRootPath(graphId) {
  return `${ORCHESTRATOR_ROOT_PATH}${normalizePathSegment(graphId)}/`;
}

export function buildGraphManifestPath(graphId) {
  return `${buildGraphRootPath(graphId)}${ORCHESTRATOR_GRAPH_FILE}`;
}

export function buildNodePath(graphId, nodeId) {
  return `${buildGraphRootPath(graphId)}${ORCHESTRATOR_NODES_DIR}${normalizePathSegment(nodeId)}.yaml`;
}

export async function listGraphs(runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const paths = await listGraphManifestPaths(runtime);

  if (!paths.length) {
    return [];
  }

  const result = await runtime.api.fileRead({
    files: paths.map((path) => ({ path }))
  });
  const files = Array.isArray(result?.files) ? result.files : [];

  return files
    .map((file) => {
      const parsedPath = parseGraphManifestPath(file?.path);
      if (!parsedPath) {
        return null;
      }

      return normalizeGraphManifest(parseYaml(runtime, file?.content), {
        fallbackId: parsedPath.id
      });
    })
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function createGraph(options = {}, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const existingGraphs = await listGraphs(runtime);
  const graph = normalizeGraphManifest({
    ...options,
    id: options.id || createGraphId(existingGraphs),
    createdAt: options.createdAt || nowIso(),
    updatedAt: options.updatedAt || nowIso()
  });

  await writeYaml(runtime, buildGraphManifestPath(graph.id), toGraphManifestPayload(graph));
  return { ...graph, nodes: [] };
}

export async function readGraph(graphId, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const id = normalizePathSegment(graphId);
  const manifestResult = await runtime.api.fileRead(buildGraphManifestPath(id));
  const manifest = normalizeGraphManifest(parseYaml(runtime, manifestResult?.content), {
    fallbackId: id
  });
  const nodeIds = normalizeNodeIds(manifest.nodeIds);
  const nodeFiles = nodeIds.length
    ? await runtime.api.fileRead({
        files: nodeIds.map((nodeId) => ({ path: buildNodePath(manifest.id, nodeId) }))
      })
    : { files: [] };
  const nodes = (Array.isArray(nodeFiles?.files) ? nodeFiles.files : [])
    .map((file) => normalizeNode(parseYaml(runtime, file?.content)))
    .filter((node) => node.id);

  return normalizeGraphManifest({
    ...manifest,
    nodeIds: nodes.map((node) => node.id),
    nodes
  });
}

export async function saveGraph(graph, runtimeInput) {
  const runtime = ensureRuntime(runtimeInput);
  const normalizedGraph = normalizeGraphManifest(graph);
  const nodes = normalizeNodes(graph?.nodes);
  const now = nowIso();
  const nextGraph = normalizeGraphManifest({
    ...normalizedGraph,
    nodeIds: nodes.map((node) => node.id),
    updatedAt: now
  });
  const files = [
    {
      path: buildGraphManifestPath(nextGraph.id),
      content: stringifyYaml(runtime, toGraphManifestPayload(nextGraph))
    },
    ...nodes.map((node) => ({
      path: buildNodePath(nextGraph.id, node.id),
      content: stringifyYaml(runtime, node)
    }))
  ];

  await runtime.api.fileWrite({ files });
  return { ...nextGraph, nodes };
}

function ensureRuntime(runtimeInput) {
  const runtime = runtimeInput || globalThis.space;
  if (
    !runtime?.api ||
    typeof runtime.api.fileRead !== "function" ||
    typeof runtime.api.fileWrite !== "function" ||
    !runtime.utils?.yaml ||
    typeof runtime.utils.yaml.parse !== "function" ||
    typeof runtime.utils.yaml.stringify !== "function"
  ) {
    throw new Error("Orchestrator storage requires space.api file helpers and space.utils.yaml.");
  }

  return runtime;
}

async function listGraphManifestPaths(runtime) {
  const response = typeof runtime.api.filePaths === "function"
    ? await runtime.api.filePaths({ patterns: [GRAPH_MANIFEST_PATTERN] })
    : await runtime.api.call("file_paths", {
        body: { patterns: [GRAPH_MANIFEST_PATTERN] },
        method: "POST"
      });

  return extractPaths(response, GRAPH_MANIFEST_PATTERN)
    .filter((path) => parseGraphManifestPath(path))
    .sort((left, right) => left.localeCompare(right));
}

function extractPaths(response, pattern) {
  if (Array.isArray(response?.[pattern])) {
    return response[pattern].map(normalizeReturnedPath).filter(Boolean);
  }
  if (Array.isArray(response?.paths)) {
    return response.paths.map(normalizeReturnedPath).filter(Boolean);
  }
  if (Array.isArray(response)) {
    return response.map(normalizeReturnedPath).filter(Boolean);
  }
  return [];
}

function normalizeReturnedPath(value) {
  return typeof value === "string" ? value : String(value?.path || "");
}

function parseGraphManifestPath(path) {
  const match = String(path || "").match(GRAPH_PATH_MATCHER);
  return match ? { id: match[1], path: match[0] } : null;
}

function normalizeGraphManifest(source = {}, options = {}) {
  const id = normalizePathSegment(source.id || options.fallbackId || "graph-1");
  const createdAt = normalizeTimestamp(source.createdAt) || nowIso();
  const updatedAt = normalizeTimestamp(source.updatedAt) || createdAt;
  const nodes = normalizeNodes(source.nodes);

  return {
    schema: ORCHESTRATOR_GRAPH_SCHEMA,
    id,
    title: normalizeGraphTitle(source.title),
    icon: normalizeGraphIcon(source.icon),
    color: normalizeGraphIconColor(source.color),
    nodeIds: normalizeNodeIds(source.nodeIds || nodes.map((node) => node.id)),
    edges: Array.isArray(source.edges) ? source.edges.map(normalizeStoredEdge).filter(Boolean) : [],
    topology: normalizeTopology(source.topology, id),
    createdAt,
    updatedAt,
    ...(nodes.length ? { nodes } : {})
  };
}

function toGraphManifestPayload(graph) {
  const {
    nodes,
    ...manifest
  } = normalizeGraphManifest(graph);

  return manifest;
}

function normalizeTopology(source, graphId) {
  const topology = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  return {
    dockerNetworkName: normalizePathSegment(topology.dockerNetworkName || `orchestrator-${graphId}`),
    applyMode: String(topology.applyMode || "manual").trim() || "manual"
  };
}

function normalizeStoredEdge(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const sourceId = String(source.source || "").trim();
  const targetId = String(source.target || "").trim();

  if (!sourceId || !targetId || sourceId === targetId) {
    return null;
  }

  return {
    id: String(source.id || `edge-${sourceId}-${targetId}`).trim(),
    source: sourceId,
    target: targetId,
    type: String(source.type || "").trim(),
    label: String(source.label || "").trim(),
    protocol: String(source.protocol || "internal").trim() || "internal"
  };
}

function normalizeNodes(value) {
  return (Array.isArray(value) ? value : []).map((node) => normalizeNode(node));
}

function normalizeNodeIds(value) {
  const ids = Array.isArray(value) ? value : [];
  return [...new Set(ids.map((id) => normalizePathSegment(id)).filter(Boolean))];
}

function normalizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/gu, "")
    .replace(/\//gu, "-");
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

function createGraphId(existingGraphs) {
  const ids = new Set((Array.isArray(existingGraphs) ? existingGraphs : []).map((graph) => graph.id));
  let index = ids.size + 1;
  let id = `graph-${index}`;

  while (ids.has(id)) {
    index += 1;
    id = `graph-${index}`;
  }

  return id;
}

function parseYaml(runtime, content) {
  return runtime.utils.yaml.parse(String(content || "")) || {};
}

function stringifyYaml(runtime, value) {
  return runtime.utils.yaml.stringify(value);
}

async function writeYaml(runtime, path, value) {
  await runtime.api.fileWrite({
    path,
    content: stringifyYaml(runtime, value)
  });
}

function nowIso() {
  return new Date().toISOString();
}

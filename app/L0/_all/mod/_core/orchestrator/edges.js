import { EDGE_COLORS, EDGE_PROTOCOLS, EDGE_TYPES } from "./constants.js";
import { getNodeCategory } from "./node-types.js";

const EDGE_TYPE_SET = new Set(EDGE_TYPES);

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

  const requestedType = String(source.type || "").trim();
  if (requestedType && !EDGE_TYPE_SET.has(requestedType)) {
    throw new Error(`Unsupported edge type: ${requestedType}.`);
  }

  const type = requestedType || deriveEdgeType(sourceNode, targetNode);
  const protocol = EDGE_PROTOCOLS.includes(source.protocol) ? source.protocol : "internal";
  const id = String(source.id || "").trim() || `edge-${sourceId}-${targetId}`;

  return {
    id,
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

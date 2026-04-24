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

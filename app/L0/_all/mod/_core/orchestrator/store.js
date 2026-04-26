import { createCamera, createZoomedCamera } from "./canvas.js";
import { ORCHESTRATOR_STORE_NAME } from "./constants.js";
import { decryptCredentialForRun } from "./credentials.js";
import { buildRunRequest } from "./agent-adapters.js";
import { createDockerClient } from "./docker-client.js";
import { createRunnerClient } from "./runner-client.js";
import { normalizeEdge } from "./edges.js";
import { createDefaultNode } from "./node-types.js";
import { createGraph, listGraphs, readGraph, saveGraph } from "./storage.js";
import {
  installOrchestratorRuntimeNamespace as installRuntimeNamespace,
  setActiveOrchestratorStore
} from "./runtime-namespace.js";

export { installOrchestratorRuntimeNamespace } from "./runtime-namespace.js";

function resolveContainerId(node) {
  return String(node?.runtime?.containerId || node?.config?.containerId || "").trim();
}

async function loadUserAgentConfig() {
  try {
    const mod = await import("/mod/_core/onscreen_agent/storage.js");
    const config = await mod.loadOnscreenAgentConfig();
    return config?.settings || null;
  } catch (error) {
    console.warn("[orchestrator] could not load onscreen-agent config", error);
    return null;
  }
}

function classifyEndpoint(endpoint) {
  const url = String(endpoint || "").toLowerCase();
  if (!url) return { nodeType: "claude_agent", providerLabel: "Claude", isOpenAICompatible: false };
  if (url.includes("api.openai.com")) return { nodeType: "openai_agent", providerLabel: "OpenAI", isOpenAICompatible: true };
  if (url.includes("api.anthropic.com")) return { nodeType: "claude_agent", providerLabel: "Claude", isOpenAICompatible: false };
  return { nodeType: "openai_agent", providerLabel: "OpenAI-Compatible", isOpenAICompatible: true };
}

async function buildFallbackCredentialForNode(node) {
  const settings = await loadUserAgentConfig();
  if (!settings) return null;
  const secret = String(settings.apiKey || "").trim();
  const endpoint = String(settings.apiEndpoint || "").trim();
  if (!secret) return null;
  const nodeType = String(node?.type || "");
  const provider = nodeType === "claude_agent" ? "anthropic" : "openai";
  return { provider, secret, baseURL: endpoint };
}

async function resolveUserSelectedModel() {
  const fallback = { nodeType: "claude_agent", model: "claude-sonnet-4-5", providerLabel: "Claude", endpoint: "" };
  const settings = await loadUserAgentConfig();
  if (!settings) return fallback;
  const rawModel = String(settings.model || "").trim();
  const endpoint = String(settings.apiEndpoint || "").trim();
  const classified = classifyEndpoint(endpoint);
  return {
    nodeType: classified.nodeType,
    providerLabel: classified.providerLabel,
    model: rawModel || fallback.model,
    endpoint
  };
}

export function createOrchestratorPageModel(deps = {}) {
  const dockerClient = deps.dockerClient || (globalThis.space ? createDockerClient() : null);
  const runnerClient = deps.runnerClient || (globalThis.space ? createRunnerClient() : null);

  return {
    graph: null,
    graphs: [],
    camera: createCamera(),
    statusMessage: "",
    dockerClient,
    runnerClient,
    _panState: null,
    get hasGraph() {
      return Boolean(this.graph?.id);
    },
    get currentGraphContextTags() {
      return this.graph?.id ? `orchestrator:open orchestrator:id:${this.graph.id}` : "";
    },
    get nodesById() {
      return Object.fromEntries((this.graph?.nodes || []).map((node) => [node.id, node]));
    },
    get graphNodes() {
      return Array.isArray(this.graph?.nodes) ? this.graph.nodes : [];
    },
    get graphEdges() {
      return Array.isArray(this.graph?.edges) ? this.graph.edges : [];
    },
    pendingPort: null,
    _dragState: null,
    _portDragState: null,
    portDragPreview: null,
    nodeUiState: {},
    activeEdgeIds: {},
    _activeEdgeTick: 0,
    _markEdgeActive(edgeId, active) {
      if (!edgeId) return;
      if (active) {
        this.activeEdgeIds[edgeId] = true;
      } else {
        delete this.activeEdgeIds[edgeId];
      }
      this._activeEdgeTick += 1;
    },
    _findEdgeBetween(nodeAId, nodeBId, type) {
      const edges = this.graph?.edges || [];
      return edges.find((edge) => {
        if (type && edge.type !== type) return false;
        return (
          (edge.source === nodeAId && edge.target === nodeBId) ||
          (edge.source === nodeBId && edge.target === nodeAId)
        );
      });
    },
    getNodeUi(nodeId) {
      if (!this.nodeUiState[nodeId]) {
        this.nodeUiState[nodeId] = { input: "", output: "", outputAt: "", meta: {} };
      }
      return this.nodeUiState[nodeId];
    },
    setNodeInput(nodeId, value) {
      this.getNodeUi(nodeId).input = String(value || "");
    },
    getNodeOutputHtml(nodeId) {
      return this._renderMarkdownToHtml(this.getNodeUi(nodeId).output);
    },
    getNodeReceivedHtml(nodeId) {
      const received = this.getNodeUi(nodeId).receivedFrom;
      if (!received?.content) return "";
      return this._renderMarkdownToHtml(received.content);
    },
    _renderMarkdownToHtml(text) {
      if (!text) return "";
      const renderer = globalThis.space?.utils?.markdown?.render;
      if (typeof renderer !== "function") {
        return `<pre>${String(text).replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</pre>`;
      }
      try {
        const root = renderer(text);
        return root?.outerHTML || "";
      } catch (error) {
        console.warn("[orchestrator] markdown render failed", error);
        return `<pre>${String(text).replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</pre>`;
      }
    },
    async persistConfigChange(nodeId) {
      try {
        await this.persistGraph();
      } catch (error) {
        console.error("[orchestrator] persist config failed", error);
        this.statusMessage = `Save failed: ${error?.message || error}`;
      }
    },
    openContainerSettings(nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      const ports = Array.isArray(node.config?.ports) ? node.config.ports : [];
      const firstHostPort = ports.find((p) => p && Number(p.host) > 0);
      const baseURL = String(node.config?.endpoint || "").trim()
        || (firstHostPort ? `http://localhost:${Number(firstHostPort.host)}` : "");
      if (!baseURL) {
        this.statusMessage = "No endpoint to open. Bind container or set config.endpoint.";
        return;
      }
      window.open(baseURL.replace(/\/+$/, "") + "/#section-agent-config", "_blank", "noopener,noreferrer");
    },
    handleNodePointerDown(event, nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      event.stopPropagation();
      if (event.target?.closest?.("button, input, textarea, .orchestrator-port")) return;
      const target = event.currentTarget?.closest?.(".orchestrator-node") || event.currentTarget;
      try { target?.setPointerCapture?.(event.pointerId); } catch {}
      this._dragState = {
        nodeId,
        pointerId: event.pointerId,
        target,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startNodeX: Number(node.x) || 0,
        startNodeY: Number(node.y) || 0,
        zoom: Number(this.camera?.zoom) || 1,
        moved: false
      };
      target?.setAttribute?.("data-dragging", "true");
    },
    handleNodePointerMove(event) {
      const state = this._dragState;
      if (!state || event.pointerId !== state.pointerId) return;
      const dx = (event.clientX - state.startClientX) / state.zoom;
      const dy = (event.clientY - state.startClientY) / state.zoom;
      if (!state.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) state.moved = true;
      const node = this.nodesById[state.nodeId];
      if (!node) return;
      node.x = state.startNodeX + dx;
      node.y = state.startNodeY + dy;
    },
    async handleNodePointerUp(event) {
      const state = this._dragState;
      if (!state || event.pointerId !== state.pointerId) return;
      this._dragState = null;
      try { state.target?.releasePointerCapture?.(event.pointerId); } catch {}
      state.target?.removeAttribute?.("data-dragging");
      if (!state.moved) return;
      try { await this.persistGraph(); } catch (error) {
        console.error("[orchestrator] persist after drag failed", error);
        this.statusMessage = `Save position failed: ${error?.message || error}`;
      }
    },
    handlePortPointerDown(event, nodeId, side) {
      event?.stopPropagation?.();
      event?.preventDefault?.();
      const portEl = event.currentTarget;
      const worldEl = portEl?.closest?.(".orchestrator-canvas")?.querySelector?.(".orchestrator-world");
      const worldRect = worldEl?.getBoundingClientRect?.();
      if (!worldRect) return;
      const zoom = Number(this.camera?.zoom) || 1;
      const portRect = portEl.getBoundingClientRect();
      const fromX = (portRect.left + portRect.width / 2 - worldRect.left) / zoom;
      const fromY = (portRect.top + portRect.height / 2 - worldRect.top) / zoom;
      this._portDragState = {
        nodeId,
        side,
        pointerId: event.pointerId,
        worldRect,
        zoom,
        fromX,
        fromY
      };
      this.pendingPort = { nodeId, side };
      this.portDragPreview = { fromX, fromY, toX: fromX, toY: fromY };
      try { document.body.setPointerCapture?.(event.pointerId); } catch {}
    },
    handlePortPointerMove(event) {
      const state = this._portDragState;
      if (!state || event.pointerId !== state.pointerId) return;
      const toX = (event.clientX - state.worldRect.left) / state.zoom;
      const toY = (event.clientY - state.worldRect.top) / state.zoom;
      this.portDragPreview = { fromX: state.fromX, fromY: state.fromY, toX, toY };
    },
    async handlePortPointerUp(event) {
      const state = this._portDragState;
      if (!state || event.pointerId !== state.pointerId) return;
      this._portDragState = null;
      this.portDragPreview = null;
      this.pendingPort = null;
      try { document.body.releasePointerCapture?.(event.pointerId); } catch {}
      const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
      const dropPort = dropTarget?.closest?.(".orchestrator-port");
      if (!dropPort) {
        this.statusMessage = "Drop on a port to connect. No edge created.";
        return;
      }
      const dropArticle = dropPort.closest(".orchestrator-node");
      const dropNodeId = dropArticle?.dataset?.nodeId || "";
      const dropSide = dropPort.classList.contains("orchestrator-port--output") ? "output" : "input";
      if (!dropNodeId) {
        this.statusMessage = "Could not identify drop target.";
        return;
      }
      if (dropNodeId === state.nodeId) {
        this.statusMessage = "Cannot connect a node to itself.";
        return;
      }
      if (dropSide === state.side) {
        this.statusMessage = `Cannot connect ${state.side} → ${dropSide}. Drag from output to input.`;
        return;
      }
      const source = state.side === "output" ? state.nodeId : dropNodeId;
      const target = state.side === "output" ? dropNodeId : state.nodeId;
      try {
        const edge = await this.addEdge({ source, target });
        this.statusMessage = `Connected ${source} → ${target} (${edge?.type || "edge"}).`;
      } catch (error) {
        console.error("[orchestrator] addEdge failed", error);
        this.statusMessage = `Connect not supported: ${error?.message || error}`;
      }
    },
    isPortPending(nodeId, side) {
      return this.pendingPort?.nodeId === nodeId && this.pendingPort?.side === side;
    },
    get portDragPreviewPath() {
      const p = this.portDragPreview;
      if (!p) return "";
      const dx = Math.max(40, Math.abs(p.toX - p.fromX) / 2);
      return `M ${p.fromX} ${p.fromY} C ${p.fromX + dx} ${p.fromY}, ${p.toX - dx} ${p.toY}, ${p.toX} ${p.toY}`;
    },
    async handleEdgeClick(event) {
      const target = event?.target;
      if (!target || typeof target.closest !== "function") return;
      const hit = target.closest("[data-edge-id]");
      if (!hit) return;
      event.stopPropagation();
      const edgeId = hit.getAttribute("data-edge-id");
      if (!edgeId) return;
      if (typeof window !== "undefined" && !window.confirm(`Remove this connection (${edgeId})?`)) return;
      try {
        await this.removeEdge({ edgeId });
        this.statusMessage = `Removed edge ${edgeId}.`;
      } catch (error) {
        console.error("[orchestrator] removeEdge failed", error);
        this.statusMessage = `Remove failed: ${error?.message || error}`;
      }
    },
    edgePathFor(edge) {
      const source = this.nodesById[edge.source];
      const target = this.nodesById[edge.target];
      if (!source || !target) return "";
      const NODE_WIDTH = 280;
      const PORT_Y = 35;
      const sx = (Number(source.x) || 0) + NODE_WIDTH;
      const sy = (Number(source.y) || 0) + PORT_Y;
      const tx = Number(target.x) || 0;
      const ty = (Number(target.y) || 0) + PORT_Y;
      const dx = Math.max(40, Math.abs(tx - sx) / 2);
      return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
    },
    get edgesSvgInner() {
      const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
      const defs = `<defs><marker id="orchestrator-edge-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 9 3 L 0 6 z" fill="rgba(74, 158, 255, 0.78)"></path></marker></defs>`;
      void this._activeEdgeTick;
      const paths = (this.graph?.edges || [])
        .map((edge) => {
          const d = this.edgePathFor(edge);
          if (!d) return "";
          const id = escape(edge.id);
          const isActive = this.activeEdgeIds[edge.id] ? " is-active" : "";
          return `<path class="orchestrator-edge-hit" data-edge-id="${id}" d="${escape(d)}"></path>`
            + `<path class="orchestrator-edge-line${isActive}" data-edge-id="${id}" d="${escape(d)}"></path>`;
        })
        .join("");
      const preview = this.portDragPreviewPath
        ? `<path class="orchestrator-edge-preview" d="${escape(this.portDragPreviewPath)}"></path>`
        : "";
      return defs + paths + preview;
    },
    async safeRemoveNode(nodeId) {
      try {
        await this.removeNode({ nodeId });
        this.statusMessage = `Removed ${nodeId}.`;
      } catch (error) {
        console.error("[orchestrator] removeNode failed", error);
        this.statusMessage = `Remove failed: ${error?.message || error}`;
      }
    },
    async clearAllNodes() {
      if (!this.graph) return;
      const count = this.graph.nodes?.length || 0;
      if (!count) return;
      if (typeof window !== "undefined" && !window.confirm(`Delete all ${count} nodes from this graph?`)) return;
      try {
        this.graph.nodes = [];
        this.graph.nodeIds = [];
        this.graph.edges = [];
        await this.persistGraph();
        this.statusMessage = `Cleared ${count} nodes.`;
      } catch (error) {
        console.error("[orchestrator] clearAllNodes failed", error);
        this.statusMessage = `Clear failed: ${error?.message || error}`;
      }
    },
    async runNode(nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      try {
        if (node.type === "docker_container") {
          await this.startContainer(nodeId);
          this.statusMessage = `Started container for ${node.name}.`;
          return;
        }
        const ui = this.getNodeUi(nodeId);
        const input = String(ui.input || "").trim();
        if (!input) {
          this.statusMessage = `${node.name}: enter a prompt in the input field, then Run.`;
          return;
        }
        await this._executeAgent(nodeId, input, new Set());
      } catch (error) {
        console.error("[orchestrator] runNode failed", error);
        this.statusMessage = `Run failed: ${error?.message || error}`;
      }
    },
    async _executeAgent(nodeId, input, visited) {
      const node = this.nodesById[nodeId];
      if (!node || node.type === "docker_container") return;
      if (visited.has(nodeId)) {
        console.warn(`[orchestrator] cycle detected at ${nodeId}, stopping`);
        return;
      }
      visited.add(nodeId);

      const controlTargets = this._findControlContainerTargets(nodeId);
      if (controlTargets.length) {
        this._setNodeOutput(nodeId, `→ relaying to ${controlTargets.length} container${controlTargets.length === 1 ? "" : "s"}…`, { prompt: input });
        await Promise.allSettled(
          controlTargets.map(async ({ node: targetNode, edgeId }) => {
            this._markEdgeActive(edgeId, true);
            try {
              const output = await this._relayToContainer(targetNode, input);
              this._setNodeOutput(targetNode.id, output, { from: node.name, prompt: input });
            } catch (error) {
              this._setNodeOutput(targetNode.id, `Error: ${error?.message || error}`, { from: node.name, prompt: input, error: true });
            } finally {
              this._markEdgeActive(edgeId, false);
            }
          })
        );
        this._setNodeOutput(nodeId, `Relayed to ${controlTargets.map((t) => t.node.name).join(", ")}`, { prompt: input });
        return;
      }

      this.statusMessage = `Running ${node.name}…`;
      const context = this._describeOutgoingConnections(nodeId);
      const augmentedInput = context ? `${context}\n\n${input}` : input;
      const result = await this.runAgentTask({ nodeId, input: augmentedInput });
      if (!result || result.status === "error") {
        this._setNodeOutput(nodeId, `Error: ${result?.error || "unknown"}`, { prompt: input, error: true });
        this.statusMessage = `Run errored: ${result?.error || "unknown"}.`;
        return;
      }
      const events = await this.runnerClient.events(result.id).catch(() => []);
      const output = this._extractFinalOutput(events) || `[run ${result.id} ${result.status}]`;
      this._setNodeOutput(nodeId, output, { runId: result.id, prompt: input });

      const delegates = this._findDelegateAgentTargets(nodeId);
      if (delegates.length) {
        await Promise.allSettled(
          delegates.map(async ({ node: targetNode, edgeId }) => {
            this._markEdgeActive(edgeId, true);
            try {
              this.getNodeUi(targetNode.id).receivedFrom = { from: node.name, content: output };
              await this._executeAgent(targetNode.id, output, visited);
            } catch (error) {
              this._setNodeOutput(targetNode.id, `Error: ${error?.message || error}`, { from: node.name, prompt: output, error: true });
            } finally {
              this._markEdgeActive(edgeId, false);
            }
          })
        );
        this.statusMessage = `${node.name} → ${delegates.length} agent${delegates.length === 1 ? "" : "s"}.`;
      } else {
        this.statusMessage = `Run ${result.id} ${result.status}.`;
      }
      console.log("[orchestrator] run result", { node: node.name, result, output });
    },
    _setNodeOutput(nodeId, output, meta = {}) {
      const ui = this.getNodeUi(nodeId);
      ui.output = String(output || "");
      ui.outputAt = new Date().toISOString();
      ui.meta = meta;
    },
    _extractFinalOutput(events) {
      if (!Array.isArray(events)) return "";
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const ev = events[i];
        if (ev?.type === "result" && ev.payload?.finalOutput) return String(ev.payload.finalOutput);
        if (ev?.payload?.message?.content) {
          const content = ev.payload.message.content;
          if (typeof content === "string") return content;
          if (Array.isArray(content)) {
            const texts = content.filter((c) => c?.type === "text" && c.text).map((c) => c.text);
            if (texts.length) return texts.join("\n");
          }
        }
      }
      return "";
    },
    _findDelegateAgentTargets(nodeId) {
      const edges = this.graph?.edges || [];
      const targets = [];
      const seen = new Set();
      for (const edge of edges) {
        if (edge.type !== "delegate") continue;
        if (edge.source !== nodeId) continue;
        const otherId = edge.target;
        if (!otherId || seen.has(otherId)) continue;
        const other = this.nodesById[otherId];
        if (other && other.type !== "docker_container") {
          targets.push({ node: other, edgeId: edge.id });
          seen.add(otherId);
        }
      }
      return targets;
    },
    _describeOutgoingConnections(nodeId) {
      const lines = [];
      for (const { node: target } of this._findControlContainerTargets(nodeId)) {
        lines.push(`- container "${target.name}" (image ${target.config?.image || "unknown"}) — you can dispatch tasks to it`);
      }
      for (const { node: target } of this._findDelegateAgentTargets(nodeId)) {
        lines.push(`- agent "${target.name}" (model ${target.config?.model || "unknown"}) — you can hand off subtasks to it`);
      }
      if (!lines.length) return "";
      return [
        "[orchestrator-context]",
        "You are running inside a multi-agent graph. Your downstream connections:",
        ...lines,
        "Frame your reply with this context in mind.",
        "[/orchestrator-context]"
      ].join("\n");
    },
    _findControlContainerTargets(nodeId) {
      const edges = this.graph?.edges || [];
      const targets = [];
      const seen = new Set();
      for (const edge of edges) {
        if (edge.type !== "control") continue;
        const otherId = edge.source === nodeId ? edge.target : edge.target === nodeId ? edge.source : "";
        if (!otherId || seen.has(otherId)) continue;
        const other = this.nodesById[otherId];
        if (other?.type === "docker_container" && (other.config?.containerId || other.config?.endpoint)) {
          targets.push({ node: other, edgeId: edge.id });
          seen.add(otherId);
        }
      }
      return targets;
    },
    async _relayToContainer(containerNode, input) {
      const explicitEndpoint = String(containerNode.config?.endpoint || "").trim();
      let hostPort = 0;
      const configuredPorts = Array.isArray(containerNode.config?.ports) ? containerNode.config.ports : [];
      const firstConfigured = configuredPorts.find((p) => p && Number(p.host) > 0);
      if (firstConfigured) hostPort = Number(firstConfigured.host);
      if (!hostPort && !explicitEndpoint && containerNode.config?.containerId && this.dockerClient?.inspect) {
        try {
          const info = await this.dockerClient.inspect(containerNode.config.containerId);
          const portMap = info?.NetworkSettings?.Ports || {};
          for (const bindings of Object.values(portMap)) {
            const entry = Array.isArray(bindings) ? bindings[0] : null;
            const port = Number(entry?.HostPort);
            if (port > 0) { hostPort = port; break; }
          }
          if (hostPort) {
            await this.updateNode({
              nodeId: containerNode.id,
              config: {
                ...(containerNode.config || {}),
                ports: [{ host: hostPort, container: hostPort, type: "tcp" }]
              }
            }).catch(() => {});
          }
        } catch (error) {
          console.warn("[orchestrator] inspect for ports failed", error);
        }
      }
      const baseURL = explicitEndpoint || (hostPort ? `http://localhost:${hostPort}` : "");
      if (!baseURL) {
        throw new Error(`${containerNode.name} has no endpoint or published host port. Set config.endpoint on the container node, or publish a port.`);
      }
      const trimmedBase = baseURL.replace(/\/+$/, "");
      const apiKey = String(containerNode.config?.apiKey || "").trim();
      if (!apiKey) {
        throw new Error(`${containerNode.name} has no API key. Open the container node, paste X-API-KEY into the field, blur to save, then Run.`);
      }

      const explicitPath = String(containerNode.config?.relayPath || "").trim();
      const candidates = explicitPath ? [explicitPath] : ["/api/api_message"];
      const payload = { message: input, lifetime_hours: 24 };
      const contextId = String(containerNode.config?.contextId || "").trim();
      if (contextId) payload.context_id = contextId;

      let lastError = null;
      let lastStatus = 0;
      let lastBodySnippet = "";
      for (const candidate of candidates) {
        const path = candidate.startsWith("/") ? candidate : `/${candidate}`;
        const url = trimmedBase + path;
        let response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": apiKey
            },
            body: JSON.stringify(payload)
          });
        } catch (error) {
          lastError = error;
          continue;
        }
        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("application/json") ? await response.json() : await response.text();
        if (response.ok) {
          if (!explicitPath) {
            await this.updateNode({
              nodeId: containerNode.id,
              config: { ...(containerNode.config || {}), relayPath: path }
            }).catch(() => {});
          }
          const newContextId = body && typeof body === "object" ? String(body.context_id || "").trim() : "";
          if (newContextId && newContextId !== contextId) {
            await this.updateNode({
              nodeId: containerNode.id,
              config: { ...(containerNode.config || {}), contextId: newContextId }
            }).catch(() => {});
          }
          if (typeof body === "string") return body;
          return body?.response || body?.message || body?.output || body?.text || body?.answer || JSON.stringify(body, null, 2);
        }
        lastStatus = response.status;
        lastBodySnippet = typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200);
        if (![404, 405].includes(response.status)) {
          throw new Error(`Container ${containerNode.name} ${response.status} at ${path}: ${lastBodySnippet}`);
        }
      }
      if (lastError) throw new Error(`Container ${containerNode.name} unreachable: ${lastError.message}`);
      throw new Error(`Container ${containerNode.name} rejected ${candidates.join(", ")}. Last status ${lastStatus}.`);
    },
    async _fetchContainerCsrfToken(baseURL, containerNode) {
      try {
        const response = await fetch(baseURL + "/", { method: "GET", credentials: "include" });
        if (!response.ok) return "";
        const html = await response.text();
        const match = html.match(/<meta\s+name=["']csrf[-_]token["']\s+content=["']([^"']+)["']/i)
          || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']csrf[-_]token["']/i)
          || html.match(/csrf[_-]?token["']?\s*[:=]\s*["']([^"']+)["']/i);
        return match ? match[1] : "";
      } catch (error) {
        console.warn("[orchestrator] csrf fetch failed", error);
        return "";
      }
    },
    async bindContainer(nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      if (!this.dockerClient) {
        this.statusMessage = "Docker client not available.";
        return;
      }
      try {
        this.statusMessage = "Fetching containers…";
        const containers = await this.dockerClient.list();
        const list = Array.isArray(containers) ? containers : [];
        if (!list.length) {
          this.statusMessage = "No Docker containers found. Create one first.";
          return;
        }
        const lines = list.map((c, i) => `${i + 1}. ${c.name || c.id.slice(0, 12)}  [${c.image}]  (${c.state})`);
        const choice = typeof window !== "undefined"
          ? window.prompt(`Pick container for ${node.name}:\n\n${lines.join("\n")}\n\nEnter number or name:`, "1")
          : null;
        if (choice === null) {
          this.statusMessage = "Bind cancelled.";
          return;
        }
        const trimmed = String(choice).trim();
        let picked = null;
        const asNum = Number(trimmed);
        if (Number.isFinite(asNum) && asNum >= 1 && asNum <= list.length) {
          picked = list[asNum - 1];
        } else {
          picked = list.find((c) => c.name === trimmed || c.id === trimmed || c.id.startsWith(trimmed));
        }
        if (!picked) {
          this.statusMessage = `No match for "${trimmed}".`;
          return;
        }
        const pickedPorts = Array.isArray(picked.ports)
          ? picked.ports.filter((p) => p && Number(p.host) > 0).map((p) => ({
              host: Number(p.host),
              container: Number(p.container) || null,
              type: p.type || "tcp"
            }))
          : [];
        await this.updateNode({
          nodeId,
          config: {
            ...(node.config || {}),
            containerId: picked.id,
            image: picked.image || node.config?.image,
            ports: pickedPorts.length ? pickedPorts : (node.config?.ports || [])
          },
          name: node.name === "Docker Container" ? picked.name || node.name : node.name,
          status: picked.state === "running" ? "running" : "idle"
        });
        this.statusMessage = `Bound ${node.name || nodeId} → ${picked.name || picked.id.slice(0, 12)} (${pickedPorts.length} port${pickedPorts.length === 1 ? "" : "s"}).`;
      } catch (error) {
        console.error("[orchestrator] bindContainer failed", error);
        this.statusMessage = `Bind failed: ${error?.message || error}`;
      }
    },
    async createAndBindContainer(nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      if (!this.dockerClient) {
        this.statusMessage = "Docker client not available.";
        return;
      }
      try {
        this.statusMessage = `Creating container from ${node.config?.image || "nginx"}…`;
        const definition = {
          graphId: this.graph?.id || "",
          nodeId,
          name: node.name?.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || `node-${nodeId}`,
          image: node.config?.image || "nginx",
          tag: node.config?.tag || "latest",
          command: node.config?.command || "",
          environment: node.config?.environment || [],
          ports: node.config?.ports || [],
          volumes: node.config?.volumes || []
        };
        const result = await this.dockerClient.create(definition);
        const containerId = String(result?.Id || result?.id || "").trim();
        if (!containerId) throw new Error("Docker create returned no id.");
        await this.dockerClient.start(containerId);
        await this.updateNode({
          nodeId,
          config: { ...(node.config || {}), containerId },
          status: "running"
        });
        this.statusMessage = `Created + started ${containerId.slice(0, 12)} for ${node.name}.`;
      } catch (error) {
        console.error("[orchestrator] createAndBindContainer failed", error);
        this.statusMessage = `Create failed: ${error?.message || error}`;
      }
    },
    async showNodeLogs(nodeId) {
      const node = this.nodesById[nodeId];
      if (!node) return;
      try {
        if (node.type === "docker_container") {
          const result = await this.getContainerLogs(nodeId, { tail: 200 });
          const output = typeof result === "string" ? result : result?.output || "";
          console.log(`[orchestrator] logs for ${node.name}:\n${output}`);
          this.statusMessage = `Logs for ${node.name} printed to console (${output.length} chars).`;
        } else {
          this.statusMessage = `Logs for ${node.type} not yet supported — open Run results panel.`;
        }
      } catch (error) {
        console.error("[orchestrator] showNodeLogs failed", error);
        this.statusMessage = `Logs failed: ${error?.message || error}`;
      }
    },
    async init() {
      setActiveOrchestratorStore(this);
      installRuntimeNamespace({ activeStore: this });
      try {
        await this.listGraphs();
        const graphId = globalThis.space?.router?.getParam?.("id") || this.graphs[0]?.id;
        if (graphId) {
          await this.openGraph(graphId);
        } else {
          this.graph = await createGraph({ title: "My Orchestration Graph" });
          await this.listGraphs();
        }
        this.statusMessage = `Loaded graph ${this.graph?.title || this.graph?.id || ""}`.trim();
      } catch (error) {
        console.error("[orchestrator] init failed", error);
        this.statusMessage = `Init failed: ${error?.message || error}`;
      }
    },
    async safeAddNode(options = {}) {
      try {
        if (!this.graph) {
          await this.init();
        }
        const count = this.graph?.nodes?.length || 0;
        const column = count % 4;
        const row = Math.floor(count / 4);
        const baseX = options.x ?? 80;
        const baseY = options.y ?? 80;
        const placed = {
          ...options,
          x: baseX + column * 320,
          y: baseY + row * 220
        };
        const node = await this.addNode(placed);
        this.statusMessage = `Added ${node?.name || node?.type || "node"} (${this.graph?.nodes?.length || 0} total)`;
        return node;
      } catch (error) {
        console.error("[orchestrator] addNode failed", error);
        this.statusMessage = `Add node failed: ${error?.message || error}`;
        return null;
      }
    },
    async safeAddAgentNode(options = {}) {
      try {
        const selected = await resolveUserSelectedModel();
        const merged = {
          ...options,
          type: selected.nodeType,
          name: options.name || `${selected.providerLabel} Agent`,
          config: {
            ...(options.config || {}),
            model: selected.model,
            endpoint: options.config?.endpoint || selected.endpoint,
            instructions: options.config?.instructions || ""
          }
        };
        return this.safeAddNode(merged);
      } catch (error) {
        console.error("[orchestrator] safeAddAgentNode failed", error);
        this.statusMessage = `Add agent failed: ${error?.message || error}`;
        return null;
      }
    },
    async safeApplyTopology() {
      try {
        return await this.applyTopology();
      } catch (error) {
        console.error("[orchestrator] applyTopology failed", error);
        this.statusMessage = `Apply topology failed: ${error?.message || error}`;
        return null;
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
      this.graph.nodes = (this.graph.nodes || []).map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node
      );
      await this.persistGraph();
      return this.graph.nodes.find((node) => node.id === nodeId);
    },
    async removeNode({ nodeId } = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      this.graph.nodes = (this.graph.nodes || []).filter((node) => node.id !== nodeId);
      this.graph.nodeIds = this.graph.nodes.map((node) => node.id);
      this.graph.edges = (this.graph.edges || []).filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      return this.persistGraph();
    },
    async addEdge(options = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      const edge = normalizeEdge(options, {
        nodesById: this.nodesById,
        existingEdges: this.graph.edges || []
      });
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
      if (!this.graph) throw new Error("No graph is open.");
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const networkName = this.graph.topology?.dockerNetworkName || `orchestrator-${this.graph.id}`;
      const connected = new Set();
      await this.dockerClient.networkCreate(networkName).catch((error) => {
        if (!/already exists/iu.test(error.message || "")) throw error;
      });
      for (const edge of this.graph.edges || []) {
        if (edge.type !== "network") continue;
        for (const nodeId of [edge.source, edge.target]) {
          const node = this.nodesById[nodeId];
          const containerId = resolveContainerId(node);
          if (containerId && !connected.has(containerId)) {
            await this.dockerClient.networkConnect(networkName, containerId);
            connected.add(containerId);
          }
        }
      }
      this.statusMessage = `Applied ${connected.size} container network connection${
        connected.size === 1 ? "" : "s"
      }.`;
      return { ok: true, connected: connected.size };
    },
    sendMessage(message) {
      return message;
    },
    async runAgentTask({ nodeId, input } = {}) {
      if (!this.graph) throw new Error("No graph is open.");
      if (!this.runnerClient) throw new Error("Runner client is not available.");
      const node = this.nodesById[nodeId];
      if (!node) throw new Error(`Node ${nodeId} is not in the current graph.`);
      const credentialRef = String(node.runtime?.credentialRef || "").trim();
      let credential = credentialRef ? await decryptCredentialForRun(credentialRef) : null;
      if (!credential) credential = await buildFallbackCredentialForNode(node);
      const request = buildRunRequest({
        graphId: this.graph.id,
        node,
        input: input || "",
        credential
      });
      return this.runnerClient.start(request);
    },
    async startContainer(nodeId) {
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const containerId = resolveContainerId(this.nodesById[nodeId]);
      if (!containerId) throw new Error(`Node ${nodeId} has no container id.`);
      return this.dockerClient.start(containerId);
    },
    async stopContainer(nodeId) {
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const containerId = resolveContainerId(this.nodesById[nodeId]);
      if (!containerId) throw new Error(`Node ${nodeId} has no container id.`);
      return this.dockerClient.stop(containerId);
    },
    async restartContainer(nodeId) {
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const containerId = resolveContainerId(this.nodesById[nodeId]);
      if (!containerId) throw new Error(`Node ${nodeId} has no container id.`);
      return this.dockerClient.restart(containerId);
    },
    async getContainerLogs(nodeId, options = {}) {
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const containerId = resolveContainerId(this.nodesById[nodeId]);
      if (!containerId) throw new Error(`Node ${nodeId} has no container id.`);
      return this.dockerClient.logs(containerId, options);
    },
    async execInContainer({ nodeId, command } = {}) {
      if (!this.dockerClient) throw new Error("Docker client is not available.");
      const containerId = resolveContainerId(this.nodesById[nodeId]);
      if (!containerId) throw new Error(`Node ${nodeId} has no container id.`);
      return this.dockerClient.exec({ containerId, command });
    },
    handleCanvasPointerDown(event) {
      const target = event?.target;
      if (!target || target.closest?.(".orchestrator-node, .orchestrator-port")) return;
      this._panState = {
        startX: event.clientX,
        startY: event.clientY,
        cameraX: this.camera.x,
        cameraY: this.camera.y
      };
    },
    handlePointerMove(event) {
      if (!this._panState) return;
      this.camera = {
        ...this.camera,
        x: this._panState.cameraX + (event.clientX - this._panState.startX),
        y: this._panState.cameraY + (event.clientY - this._panState.startY)
      };
    },
    handlePointerUp() {
      this._panState = null;
    },
    handleWheel(event) {
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.camera = createZoomedCamera({
          camera: this.camera,
          nextZoom: this.camera.zoom * factor,
          pointerX: event.clientX,
          pointerY: event.clientY
        });
        return;
      }
      this.camera = {
        ...this.camera,
        x: this.camera.x - event.deltaX,
        y: this.camera.y - event.deltaY
      };
    }
  };
}

if (globalThis.space?.fw?.createStore) {
  globalThis.space.fw.createStore(ORCHESTRATOR_STORE_NAME, createOrchestratorPageModel());
  installRuntimeNamespace({ activeStore: null });
}

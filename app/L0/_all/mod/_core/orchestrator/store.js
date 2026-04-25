import { createCamera, createZoomedCamera } from "./canvas.js";
import { ORCHESTRATOR_ROUTE_PATH, ORCHESTRATOR_STORE_NAME } from "./constants.js";
import { decryptCredentialForRun } from "./credentials.js";
import { buildRunRequest } from "./agent-adapters.js";
import { createDockerClient } from "./docker-client.js";
import { createRunnerClient } from "./runner-client.js";
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

function resolveContainerId(node) {
  return String(node?.runtime?.containerId || node?.config?.containerId || "").trim();
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
      const credential = credentialRef ? await decryptCredentialForRun(credentialRef) : null;
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
  installOrchestratorRuntimeNamespace({ activeStore: null });
}

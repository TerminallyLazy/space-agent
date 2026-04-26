import { ORCHESTRATOR_ROUTE_PATH } from "./constants.js";
import { createGraph, listGraphs, readGraph } from "./storage.js";

let activeStore = null;

export function setActiveOrchestratorStore(store) {
  activeStore = store || null;
}

export function getActiveOrchestratorStore() {
  return activeStore;
}

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

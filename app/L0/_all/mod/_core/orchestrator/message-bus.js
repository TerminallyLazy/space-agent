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
  const busGraphId = String(graphId || "").trim();
  const edgeKeys = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));

  return {
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    send(source) {
      const callerGraphId = String(source.graphId || "").trim();
      if (busGraphId && callerGraphId && callerGraphId !== busGraphId) {
        throw new Error(`Message graphId ${callerGraphId} does not match bus graphId ${busGraphId}.`);
      }

      const message = normalizeBusMessage({ ...source, graphId: callerGraphId || busGraphId });
      const key = `${message.source}->${message.target}`;
      if (!edgeKeys.has(key)) {
        throw new Error(`No edge allows ${key}.`);
      }
      subscribers.forEach((callback) => callback(message));
      return message;
    }
  };
}

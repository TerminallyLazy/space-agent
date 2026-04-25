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

import { assertAdmin, createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  assertAdmin(context);
  const networkName = String(context.body?.networkName || "").trim();
  const containerId = String(context.body?.containerId || "").trim();
  if (!networkName || !containerId) {
    const error = new Error("networkName and containerId are required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).networkDisconnect(networkName, containerId);
}

import { assertAdmin, createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  assertAdmin(context);
  const containerId = String(context.body?.containerId || "").trim();
  if (!containerId) {
    const error = new Error("containerId is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).remove(containerId);
}

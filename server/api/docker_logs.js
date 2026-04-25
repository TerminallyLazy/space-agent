import { createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function get(context) {
  const containerId = String(context.query?.containerId || context.body?.containerId || "").trim();
  if (!containerId) {
    const error = new Error("containerId is required.");
    error.statusCode = 400;
    throw error;
  }
  const tail = Number(context.query?.tail || context.body?.tail || 100);
  return getService(context).logs(containerId, { tail: Number.isFinite(tail) ? tail : 100 });
}

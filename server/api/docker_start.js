import { createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  const containerId = String(context.body?.containerId || "").trim();
  if (!containerId) {
    const error = new Error("containerId is required.");
    error.statusCode = 400;
    throw error;
  }
  try {
    return await getService(context).start(containerId);
  } catch (error) {
    if (Number(error?.statusCode) === 304) {
      return { ok: true, containerId, alreadyRunning: true };
    }
    throw error;
  }
}

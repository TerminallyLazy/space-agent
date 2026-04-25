import { assertAdmin, createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  assertAdmin(context);
  const networkName = String(context.body?.networkName || "").trim();
  if (!networkName) {
    const error = new Error("networkName is required.");
    error.statusCode = 400;
    throw error;
  }
  return getService(context).networkCreate(networkName);
}

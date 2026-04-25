import { assertAdmin, createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function post(context) {
  assertAdmin(context);
  return getService(context).create(context.body || {});
}

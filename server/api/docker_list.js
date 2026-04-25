import { createDockerServiceFromContext } from "../lib/docker/client.js";

function getService(context) {
  return context.dockerService || createDockerServiceFromContext(context);
}

export async function get(context) {
  return getService(context).list();
}

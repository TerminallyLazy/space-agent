import Docker from "dockerode";

import { getRuntimeGroupIndex } from "../customware/group_runtime.js";

const MANAGED_LABEL_PREFIX = "space.orchestrator.";

export function resolveDockerOptions(runtimeParams) {
  const host = String(runtimeParams?.get?.("DOCKER_HOST", "") || "").trim();
  if (!host) {
    return { socketPath: "/var/run/docker.sock" };
  }
  if (host.startsWith("tcp://")) {
    const url = new URL(host);
    return {
      host: url.hostname,
      port: url.port,
      protocol: url.protocol.replace(":", "") === "https" ? "https" : "http"
    };
  }
  if (host.startsWith("unix://")) {
    return { socketPath: host.replace(/^unix:\/\//u, "") };
  }
  return { socketPath: host };
}

export function createDockerClient(runtimeParams) {
  return new Docker(resolveDockerOptions(runtimeParams));
}

export function assertAdmin(context) {
  const username = context.user?.username || "";
  if (username) {
    const groups = context.user?.groups;
    if (Array.isArray(groups) && groups.includes("_admin")) {
      return;
    }

    const groupIndex = getRuntimeGroupIndex(context.watchdog, context.runtimeParams);
    if (
      groupIndex &&
      typeof groupIndex.isUserInGroup === "function" &&
      groupIndex.isUserInGroup(username, "_admin")
    ) {
      return;
    }
  }

  const error = new Error("Docker mutation requires _admin membership.");
  error.statusCode = 403;
  throw error;
}

export function normalizeContainerSummary(container) {
  const labels = container.Labels || {};
  return {
    id: String(container.Id || ""),
    name: String(container.Names?.[0] || container.Name || "").replace(/^\//u, ""),
    image: String(container.Image || ""),
    state: String(container.State || ""),
    status: String(container.Status || ""),
    ports: (container.Ports || []).map((port) => ({
      host: port.PublicPort || null,
      container: port.PrivatePort || null,
      type: port.Type || "tcp"
    })),
    labels,
    managed: Object.keys(labels).some((key) => key.startsWith(MANAGED_LABEL_PREFIX))
  };
}

export function createDockerService({ docker }) {
  return {
    async list() {
      const containers = await docker.listContainers({ all: true });
      return containers.map(normalizeContainerSummary);
    },
    async inspect(containerId) {
      return docker.getContainer(containerId).inspect();
    },
    async create(definition) {
      const container = await docker.createContainer(buildCreateOptions(definition));
      return container.inspect();
    },
    async start(containerId) {
      await docker.getContainer(containerId).start();
      return { ok: true, containerId };
    },
    async stop(containerId) {
      await docker.getContainer(containerId).stop();
      return { ok: true, containerId };
    },
    async restart(containerId) {
      await docker.getContainer(containerId).restart();
      return { ok: true, containerId };
    },
    async remove(containerId) {
      await docker.getContainer(containerId).remove({ force: true });
      return { ok: true, containerId };
    },
    async logs(containerId, { tail = 100 } = {}) {
      const output = await docker.getContainer(containerId).logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: false
      });
      return Buffer.isBuffer(output)
        ? output.toString("utf8").slice(-65536)
        : String(output || "").slice(-65536);
    },
    async exec({ containerId, command }) {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: Array.isArray(command) ? command : ["sh", "-lc", String(command || "")],
        AttachStdout: true,
        AttachStderr: true
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      return { ok: true, output: String(stream || "").slice(-65536) };
    },
    async networkCreate(networkName) {
      await docker.createNetwork({ Name: networkName, Driver: "bridge" });
      return { ok: true, networkName };
    },
    async networkConnect(networkName, containerId) {
      await docker.getNetwork(networkName).connect({ Container: containerId });
      return { ok: true, networkName, containerId };
    },
    async networkDisconnect(networkName, containerId) {
      await docker.getNetwork(networkName).disconnect({ Container: containerId, Force: true });
      return { ok: true, networkName, containerId };
    }
  };
}

export function createDockerServiceFromContext(context) {
  return createDockerService({ docker: createDockerClient(context.runtimeParams) });
}

function buildCreateOptions(definition = {}) {
  const graphId = String(definition.graphId || "").trim();
  const nodeId = String(definition.nodeId || "").trim();
  return {
    Image: `${definition.image || "nginx"}:${definition.tag || "latest"}`,
    name: definition.name || undefined,
    Cmd: definition.command ? ["sh", "-lc", definition.command] : undefined,
    Env: (definition.environment || []).map(({ key, value }) => `${key}=${value}`),
    Labels: {
      "space.orchestrator.managed": "true",
      "space.orchestrator.graph": graphId,
      "space.orchestrator.node": nodeId
    },
    HostConfig: {
      PortBindings: Object.fromEntries(
        (definition.ports || []).map((port) => [
          `${port.container}/tcp`,
          [{ HostPort: String(port.host) }]
        ])
      ),
      Binds: (definition.volumes || []).map((volume) => `${volume.host}:${volume.container}`)
    }
  };
}

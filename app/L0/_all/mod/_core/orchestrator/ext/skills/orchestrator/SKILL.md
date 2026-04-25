---
metadata:
  when:
    tags: [orchestrator:open]
  loaded:
    tags: [orchestrator:open]
  placement: transient
---

# Orchestrator Skill

You are operating inside the Orchestrator canvas. The current graph topology is available through `space.orchestrator`.

Use `space.orchestrator` for graph edits and runs:

- `await space.orchestrator.listGraphs()`
- `await space.orchestrator.createGraph({ title: "..." })`
- `await space.orchestrator.addNode({ type: "docker_container", name: "...", x: 0, y: 0, config: { image: "nginx", tag: "latest" } })`
- `await space.orchestrator.addNode({ type: "openai_agent", name: "...", x: 320, y: 0, runtime: { credentialRef: "openai-main" } })`
- `await space.orchestrator.addEdge({ source: "node-a", target: "node-b" })`
- `await space.orchestrator.applyTopology()`
- `await space.orchestrator.runAgentTask({ nodeId: "node-a", input: "..." })`
- `await space.orchestrator.startContainer("node-id")`
- `await space.orchestrator.stopContainer("node-id")`
- `await space.orchestrator.getContainerLogs("node-id")`

Edge behavior:

- container to container edges create Docker network topology.
- agent to container edges allow container control.
- container to agent edges provide monitor/log context.
- agent to agent edges allow delegation.
- agent to agent edges with `protocol: "a2a"` use the A2A adapter when the target supports it.

Provider credentials are referenced by `credentialRef`; do not write provider secrets into graph or node YAML.

Always finish execution with a short plain-text summary of what changed or what failed.

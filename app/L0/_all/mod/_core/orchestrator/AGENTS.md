# AGENTS

## Purpose

`_core/orchestrator/` owns the first-party graph orchestration surface for Docker containers and AI agents.

It provides a routed infinite canvas, graph/node/edge persistence under `~/orchestrator/`, a graph-open message bus, frontend clients for backend Docker and runner APIs, and the `space.orchestrator` runtime namespace.

Documentation is top priority for this module. After any change under `_core/orchestrator/`, update this file and any affected parent docs in the same session.

## Ownership

- `view.html` owns the routed graph DOM, canvas anchors, topbar injection, and Alpine bindings.
- `orchestrator.css` owns graph-specific canvas, node, edge, port, and toolbar styling.
- `store.js` owns `$store.orchestratorPage`, mounted graph lifecycle, runtime namespace methods, topology application, and browser-side orchestration.
- `storage.js` owns all `~/orchestrator/` YAML persistence.
- `canvas.js` owns camera math, coordinate transforms, pan, zoom, and drag helpers.
- `node-types.js` owns node defaults, node categories, type-specific config, and normalization.
- `edges.js` owns edge typing, duplicate/self-loop rejection, edge colors, and Bezier path helpers.
- `message-bus.js` owns graph-open typed message routing.
- `credentials.js` owns encrypted credential record helpers.
- `docker-client.js` owns browser calls to Docker endpoints.
- `runner-client.js` owns browser calls to agent-run endpoints.
- `agent-adapters.js` owns browser-side run request shaping.
- `graph-metadata.js` owns shared graph title/icon normalization helpers.
- `constants.js` owns orchestrator route, storage path, schema, camera, node type, edge type, protocol, color, and store name constants.
- `ext/html/` owns dashboard and onscreen-menu entry points.
- `ext/skills/orchestrator/SKILL.md` owns agent guidance while an Orchestrator graph is open.

## Persistence Contract

Graphs persist under `~/orchestrator/<graphId>/`:

- `graph.yaml` stores graph metadata, node ids, edges, topology settings, and timestamps.
- `nodes/<nodeId>.yaml` stores one normalized node record.
- `runs/<runId>.yaml` and `messages/<date>.yaml` store compact graph-open activity records.

Encrypted credentials live under `~/orchestrator/secrets/` and are referenced by `credentialRef`. Provider secrets must not be written into graph or node YAML.

## Runtime Namespace

`space.orchestrator` exposes graph CRUD, node/edge mutation, topology application, graph-open messaging, agent runs, and Docker node controls. Methods default to the mounted graph when a graph is open and throw clear errors when no graph context is available.

## Edge Semantics

- container to container: Docker network topology.
- agent to container: control permission.
- container to agent: monitor/log context.
- agent to agent: delegation.
- agent to agent with `protocol: a2a`: delegation through the A2A adapter.

## Development Guidance

Keep graph state and UI behavior in this module. Keep Docker socket access and SDK execution in server helpers. Use `space.api` for I/O, `space.utils.yaml` for YAML, and `_core/visual` primitives for shared chrome.

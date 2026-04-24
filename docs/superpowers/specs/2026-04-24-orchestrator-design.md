# Orchestrator Design

Date: 2026-04-24

## Purpose

Build a first-party Space Agent Orchestrator module at `app/L0/_all/mod/_core/orchestrator/`.

The module provides an infinite, pannable, zoomable node-graph canvas where users can model and run orchestration topologies across Docker containers, Space Agent agents, Agent Zero agents, Claude Agent SDK agents, OpenAI Agents SDK agents, and external A2A-compatible agents.

This is a full-platform design. The first implementation phase should ship the real graph surface, persistence, Docker APIs, Claude/OpenAI runner endpoints, encrypted per-run credential handoff, and graph-open message routing. Always-on daemon execution, background scheduling, and deep native Agent Zero or Space Agent runtime control are later phases.

## Repository Context

Space Agent is browser-first. The browser app owns graph state, user interaction, runtime composition, YAML persistence, encrypted user credential handling, and live orchestration while the graph is open.

Backend additions are allowed only for boundaries the browser cannot safely own:

- Docker socket access.
- Server-side Claude/OpenAI SDK execution.
- A2A forwarding when CORS, auth headers, or local network access require the server as a narrow proxy.

The implementation must follow the existing module model:

- routed module under `app/L0/_all/mod/_core/orchestrator/`
- Alpine store created with `space.fw.createStore(...)`
- app-file persistence through `space.api`
- YAML through `space.utils.yaml`
- explicit `space.orchestrator` runtime namespace
- HTML extension seams for dashboard and onscreen-menu entry points
- auto-loaded transient skill under `ext/skills/orchestrator/SKILL.md`

## Architecture

Orchestrator has three layers.

Browser module:

- renders the infinite graph canvas
- owns graph/node/edge state
- reads and writes `~/orchestrator/`
- decrypts selected provider credentials through `space.utils.userCrypto`
- calls Docker and runner backend APIs through `space.api`
- routes live graph-open messages across allowed edges
- exposes `space.orchestrator`

Server infrastructure:

- exposes narrow Docker endpoints and shared Docker helper code
- exposes Claude/OpenAI runner endpoints and shared adapter code
- receives per-run credentials from the browser and never persists them
- optionally forwards A2A requests after graph edge checks and URL validation

Provider/runtime adapters:

- normalize Docker, Space Agent, Agent Zero, Claude, OpenAI, and A2A behavior behind a small agent/runtime contract
- prevent provider-specific event shapes from becoming persisted graph schema
- keep SDK-specific settings inside typed node config

The graph model is provider-neutral. A2A is an optional interoperability adapter for agent-to-agent edges, not the internal orchestration protocol and not the Docker/network control model.

## Module Files

Create this module tree, with thin extension files and implementation in module-owned JS/CSS:

```text
app/L0/_all/mod/_core/orchestrator/
  AGENTS.md
  view.html
  orchestrator.css
  store.js
  storage.js
  canvas.js
  node-types.js
  edges.js
  constants.js
  graph-metadata.js
  agent-adapters.js
  message-bus.js
  credentials.js
  docker-client.js
  runner-client.js
  ext/html/_core/dashboard/content_middle/orchestrator-dashboard-launcher.html
  ext/html/_core/dashboard/topbar_primary/new-graph.html
  ext/html/_core/onscreen_menu/items/orchestrator.html
  ext/skills/orchestrator/SKILL.md
```

Responsibilities:

- `view.html` mounts the routed full-bleed graph page for `#/orchestrator?id=<graphId>`.
- `store.js` owns `$store.orchestratorPage`, graph lifecycle, runtime namespace wiring, and UI orchestration.
- `storage.js` owns all `~/orchestrator/` reads and writes.
- `canvas.js` owns camera math, pointer handling, pan, zoom, and node drag behavior.
- `edges.js` owns edge typing, SVG Bezier rendering, hit paths, and connection preview state.
- `node-types.js` owns node defaults, validation, display metadata, and typed config normalization.
- `agent-adapters.js` owns browser-side adapter registry and run request shaping.
- `message-bus.js` owns graph-open event routing.
- `credentials.js` owns encrypted user credential helpers.
- `docker-client.js` wraps Docker backend APIs.
- `runner-client.js` wraps Claude/OpenAI runner APIs.

The route should rely on the router's normal `#/orchestrator` resolution. Add a router-owned `data-route-path="orchestrator"` full-bleed override like the existing spaces route because this page must not be constrained to the default centered document flow.

## Persistence

Graphs persist under the authenticated user's writable app files:

```text
~/orchestrator/<graphId>/
  graph.yaml
  nodes/<nodeId>.yaml
  runs/<runId>.yaml
  messages/<date>.yaml
~/orchestrator/secrets/<credentialRef>.yaml
```

`graph.yaml`:

```yaml
schema: orchestrator-graph/v1
id: graph-1
title: My Orchestration Graph
icon: account_tree
icon_color: "#4a9eff"
nodeIds: [node-a, node-b]
edges:
  - id: edge-1
    source: node-a
    target: node-b
    type: delegate
    label: ""
    protocol: internal
topology:
  dockerNetworkName: orchestrator-graph-1
  applyMode: manual
createdAt: "2026-04-24T00:00:00.000Z"
updatedAt: "2026-04-24T00:00:00.000Z"
```

Node files use a common envelope and typed `config`:

```yaml
schema: orchestrator-node/v1
id: node-abc12345
type: openai_agent
name: Research Agent
x: 120
y: 80
status: idle
config:
  model: gpt-5.5
  instructions: ""
  tools: []
runtime:
  mode: server_sdk
  credentialRef: openai-default
```

Supported first-party node types:

- `docker_container`
- `space_agent`
- `agent_zero`
- `claude_agent`
- `openai_agent`
- `external_a2a_agent`

Docker-backed node config must support both modes:

- attach to an existing `containerId`
- create a managed container from image/env/ports/volumes/command/network settings

Managed containers must be labeled with graph and node identifiers so backend operations can distinguish Orchestrator-owned containers from attached external containers.

Credentials are never stored in graph or node YAML. Nodes reference `credentialRef`; encrypted credential records live under `~/orchestrator/secrets/` and are decrypted in the browser only when making a run request.

Run and message files are compact graph-open records. They are not an always-on backend log.

## Node And Edge Semantics

Node categories:

- Container: Docker container and Docker-backed Agent Zero or Space Agent deployments.
- Agent: Space Agent, Agent Zero, Claude Agent SDK, OpenAI Agents SDK, and external A2A agents.
- Hybrid: Agent Zero and containerized Space Agent nodes can have both container lifecycle controls and agent delegation behavior.

Directed edges define allowed topology and communication:

- container to container: `network`
- agent to container: `control`
- container to agent: `monitor`
- agent to agent: `delegate`
- agent to agent with A2A adapter: `delegate` plus `protocol: a2a`

The store must reject self-loops, duplicate edges, missing node endpoints, and unsupported source/target category pairs before persistence.

`Apply Topology` enforces stable topology facts only:

- container/container edges create and connect the graph Docker network
- agent/container edges update the graph's control mapping
- container/agent edges start graph-open log/status monitoring
- agent/agent edges update delegate routing and A2A adapter metadata

Task execution remains a separate manual run action from a node card, toolbar, or `space.orchestrator` call.

## Canvas Interaction

The canvas is free-form and infinite, not grid-based.

Camera state:

```js
{ x: 0, y: 0, zoom: 1 }
```

Rules:

- `x` and `y` are world origin offsets in pixels.
- `zoom` ranges from `0.1` to `3.0`.
- pan by pointer-dragging the background
- zoom by wheel or pinch toward the pointer position
- expose `canvasToWorld(...)` and `worldToCanvas(...)`
- drag nodes only from the node header
- store node positions as world pixels
- no native page scrollbars inside the canvas

Edges render as SVG Bezier paths below node cards. Output ports are on the right center; input ports are on the left center. Connection drawing starts from an output port, previews a Bezier to the pointer, completes on a valid input port, and cancels on background click or Escape.

## Runtime Namespace

Register `space.orchestrator` with a narrow public API:

```js
space.orchestrator.listGraphs()
space.orchestrator.createGraph(options)
space.orchestrator.openGraph(graphId)
space.orchestrator.readGraph(graphId)
space.orchestrator.removeGraph(graphId)
space.orchestrator.addNode({ graphId, type, name, x, y, config, runtime })
space.orchestrator.updateNode({ graphId, nodeId, ...patch })
space.orchestrator.removeNode({ graphId, nodeId })
space.orchestrator.addEdge({ graphId, source, target, protocol })
space.orchestrator.removeEdge({ graphId, edgeId })
space.orchestrator.applyTopology(graphId)
space.orchestrator.sendMessage(message)
space.orchestrator.runAgentTask({ graphId, nodeId, input, credentialRef })
space.orchestrator.startContainer(nodeId)
space.orchestrator.stopContainer(nodeId)
space.orchestrator.restartContainer(nodeId)
space.orchestrator.getContainerLogs(nodeId)
space.orchestrator.execInContainer({ nodeId, command })
```

Runtime APIs should default `graphId` to the currently open graph when a graph is mounted. They should throw clear errors when no graph is open and no explicit graph id was supplied.

## Live Message Bus

The message bus exists only while the graph is open in the browser.

Message envelope:

```js
{
  id,
  graphId,
  source,
  target,
  type: "task" | "result" | "log" | "status" | "control",
  protocol: "internal" | "a2a",
  createdAt,
  payload
}
```

The bus must:

- route only across existing allowed edges
- persist compact run summaries and event batches
- surface live status on node cards
- avoid keeping a backend daemon alive after the browser closes

Always-on scheduling, retries, and browser-closed monitoring are out of scope.

## Backend Design

Docker endpoints should be named with the existing object-first convention and delegate shared Docker behavior to `server/lib/docker/`.

Initial Docker API family:

- `docker_list`
- `docker_inspect`
- `docker_create`
- `docker_start`
- `docker_stop`
- `docker_restart`
- `docker_remove`
- `docker_logs`
- `docker_exec`
- `docker_network_create`
- `docker_network_connect`
- `docker_network_disconnect`

Policy:

- all endpoints are authenticated by default
- list/inspect/logs/start/stop/restart are authenticated
- create/remove/exec/network mutation require `_admin`
- removal of managed containers is allowed only for Orchestrator-labeled containers unless the caller is explicitly detaching an existing-container node
- log and exec output must be bounded

Add `DOCKER_HOST` to `commands/params.yaml` with `frontend_exposed: false`.

Runner endpoints should expose normalized run operations rather than provider-specific graph schema:

- `agent_run_start`
- `agent_run_status`
- `agent_run_stop`
- `agent_run_events`

Use these endpoint names unless implementation discovers a direct conflict with an existing route; any conflict-driven rename must stay object-first and be documented in `server/api/AGENTS.md`.

Runner policy:

- credentials are supplied per run by the browser
- server never writes provider credentials to disk
- provider errors redact secrets
- Claude/OpenAI event streams normalize into Orchestrator run events
- phase one can use request/response plus polling if streaming would require broad router changes

A2A support is an adapter:

- read or store remote agent-card metadata in node config
- validate outbound A2A URLs
- block unsafe internal/local fetch targets unless a later explicit admin setting permits them
- send A2A tasks only after graph edge checks pass

## Claude, OpenAI, Agent Zero, And Space Agent Adapters

Claude node:

- uses Claude Agent SDK on the server
- supports model, instructions, allowed tools, permission settings, session settings, and optional MCP config
- reports missing SDK package, missing credential, permission failure, and run failure as adapter status states

OpenAI node:

- uses OpenAI Agents SDK on the server
- supports model, instructions, tools, handoffs, guardrails, tracing labels, and sandbox settings
- keeps sandbox/container details in node config without making OpenAI the internal graph model

Agent Zero node:

- is both a Docker-backed deployment and an agent adapter
- can attach to or create a Docker container
- exposes health/log/deploy controls plus normalized delegation
- deeper Agent Zero-specific controls are a later phase

Space Agent node:

- represents delegation into local or containerized Space Agent runtime
- first phase can expose normalized delegation hooks and deployment metadata
- deeper native runtime control is a later phase

External A2A node:

- stores endpoint and agent-card metadata
- delegates through the A2A adapter
- never requires Orchestrator to expose provider internals

## UI Design

The page should feel like a quiet operational canvas, not a marketing surface.

Toolbar:

- Back
- editable graph title and icon
- Add node menu
- Apply Topology
- Fit View
- zoom controls
- graph status

Node cards:

- 8px radius
- no box-shadow
- compact header, summary body, footer actions
- left input and right output ports
- icon via `x-icon`
- status badge for idle/running/stopped/error/missing config

Color semantics:

- network: blue
- control: amber
- monitor: green
- delegate: purple
- A2A delegate: purple with distinct label or dash pattern

Use existing `_core/visual` button, dialog, surface, toast, and icon patterns where they fit. Feature-local CSS should only cover graph-specific canvas, node, edge, and toolbar layout.

## Error Handling

Frontend:

- show canvas/storage errors through shared visual toast plus inline graph status
- normalize invalid YAML where safe and show a recoverable warning
- block invalid edges with a short reason
- disable run actions when required credentials are missing
- show Docker unavailable, SDK missing, credential rejected, and provider failure as node adapter status
- persist failed run summaries with final error category and message

Backend:

- Docker daemon unavailable returns a service-unavailable error
- Docker errors distinguish auth, `_admin`, missing container, and daemon failure where possible
- SDK errors redact credentials and include provider/runtime categories
- log/stdout/stderr output is bounded
- A2A forwarding validates URLs and does not persist auth headers

## Documentation

Implementation must update documentation in the same session as code changes.

Required docs:

- `app/L0/_all/mod/_core/orchestrator/AGENTS.md`
- root `AGENTS.md` file index
- `app/AGENTS.md` module docs list and major module owners
- `server/api/AGENTS.md` for Docker and runner endpoint families
- `server/AGENTS.md` if server-wide API ownership changes
- `commands/AGENTS.md` and `app/L0/_all/mod/_core/documentation/docs/cli/commands-and-runtime-params.md` for `DOCKER_HOST`
- supplemental app/server documentation under `app/L0/_all/mod/_core/documentation/docs/`
- `app/L0/_all/mod/_core/documentation/ext/skills/documentation/SKILL.md` if the docs map changes
- Orchestrator `ext/skills/orchestrator/SKILL.md`

## Testing

Focused test coverage should match risk.

Unit-style tests:

- graph and node normalization
- edge typing and duplicate prevention
- graph id and node id generation
- credential reference validation without decrypting real secrets
- Docker helper request validation with mocked Docker client
- Claude/OpenAI runner adapters with mocked SDK modules

Browser harness or integration checks:

- route mounts at `#/orchestrator`
- empty canvas renders
- add nodes
- drag nodes
- connect ports
- persist and reload graph
- apply topology calls expected client wrappers
- node/edge text fits and controls do not overlap at desktop and mobile sizes

Manual verification:

- run the dev server
- open `#/orchestrator`
- confirm canvas is nonblank, pannable, zoomable, and hit-testable
- confirm Docker unavailable and missing credential states are visible and recoverable

## Phasing

Phase one:

- module shell, route, dashboard/menu entry points
- canvas pan/zoom/drag/connect
- YAML graph/node persistence
- `space.orchestrator` namespace
- encrypted credential records and per-run handoff
- Docker API/helper family
- managed and attached Docker container nodes
- Claude/OpenAI runner endpoints with real SDK adapters
- graph-open message bus
- Orchestrator skill and documentation

Phase two:

- richer Agent Zero deployment templates and delegation behavior
- richer Space Agent delegation/runtime control
- stronger A2A agent-card UX and compatibility checks
- streaming runner events if phase one used polling
- improved run history browsing

Out of scope for this design:

- always-on orchestration daemon
- scheduled/background retries after browser close
- Kubernetes or remote Docker cluster management
- server-side credential vault
- storing provider secrets in graph YAML

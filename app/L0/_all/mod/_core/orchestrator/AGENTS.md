# AGENTS

## Purpose

`_core/orchestrator/` owns the browser-side orchestration graph model and app-file storage helpers.

This module defines versioned graph and node constants, graph metadata normalization, node defaults and normalization, edge typing helpers, canvas camera math, an in-memory message-bus helper, and YAML-backed app-file storage for orchestration graphs. It must not add UI, backend APIs, runtime namespaces, Docker clients, or server-owned behavior until a later task explicitly adds those surfaces.

Documentation is top priority for this module. After any change under `_core/orchestrator/`, update this file and any affected parent docs in the same session.

## Ownership

This module currently owns:

- `constants.js`: orchestrator route, storage-path, schema, camera, node type, edge type, protocol, color, and store-name constants.
- `graph-metadata.js`: inline text, graph title, icon, icon color, and display-title normalization helpers.
- `node-types.js`: node type normalization, node category detection, node id creation, typed node defaults, and node normalization.
- `edges.js`: source/target category edge-type derivation, edge normalization, stable semantic edge colors, and Bezier path generation.
- `canvas.js`: camera normalization, zoom clamping, canvas/world coordinate conversion, and pointer-anchored zoom math.
- `message-bus.js`: bus-message normalization and in-memory routing across explicitly allowed directed graph edges.
- `storage.js`: browser-owned YAML app-file storage helpers for graph manifests at `~/orchestrator/<graph-id>/graph.yaml` and node files at `~/orchestrator/<graph-id>/nodes/<node-id>.yaml`.

Expected future orchestrator surfaces should stay under this module unless another owning `AGENTS.md` is added for a deeper subtree.

## Local Contracts

- Keep model helpers pure and browser-safe.
- Use ES module syntax.
- Preserve schema constants as stable serialized-data contracts.
- Give every normalized node independent nested `config` and `runtime` objects so mutation of one node cannot alter later defaults.
- Reject self-loop and duplicate edges during edge normalization.
- Keep edge colors semantic and stable because later UI code will render them by edge type.
- Keep camera helpers deterministic and side-effect free; clamp zoom to the constants in `constants.js` and preserve pointer world position when zooming.
- Keep the message bus in-memory and graph-scoped. It may deliver messages only across directed edges supplied to `createMessageBus()` and must not create storage, networking, backend APIs, or runtime namespaces.
- Keep orchestrator storage browser-owned through `space.api.fileRead`, `space.api.fileWrite`, `file_paths`/`filePaths`, and `space.utils.yaml`; do not add dedicated backend endpoints for graph persistence.
- Storage manifests use schema `orchestrator-graph/v1`, normalized graph title/icon/color fields, `nodeIds`, `edges`, default topology `{ dockerNetworkName: "orchestrator-<graph-id>", applyMode: "manual" }`, and timestamps. Node files use `normalizeNode()` and schema `orchestrator-node/v1`.
- Do not introduce backend ownership for orchestrator behavior unless the browser cannot safely enforce the contract and the user explicitly approves backend work.

## Development Guidance

- Add focused `node:test` coverage under `tests/` when model behavior changes.
- Keep helpers small and reusable for later UI and runtime layers.
- If a later task adds child docs beneath this module, add a `Documentation Hierarchy` section here before those child docs land.

# AGENTS

## Purpose

`_core/orchestrator/` owns the browser-side orchestration graph model.

This module is currently model-only. It defines versioned graph and node constants, graph metadata normalization, node defaults and normalization, and edge typing helpers. It must not add UI, storage, backend APIs, runtime namespaces, or server-owned behavior until a later task explicitly adds those surfaces.

Documentation is top priority for this module. After any change under `_core/orchestrator/`, update this file and any affected parent docs in the same session.

## Ownership

This module currently owns:

- `constants.js`: orchestrator route, storage-path, schema, camera, node type, edge type, protocol, color, and store-name constants.
- `graph-metadata.js`: inline text, graph title, icon, icon color, and display-title normalization helpers.
- `node-types.js`: node type normalization, node category detection, node id creation, typed node defaults, and node normalization.
- `edges.js`: source/target category edge-type derivation, edge normalization, stable semantic edge colors, and Bezier path generation.

Expected future orchestrator surfaces should stay under this module unless another owning `AGENTS.md` is added for a deeper subtree.

## Local Contracts

- Keep model helpers pure and browser-safe.
- Use ES module syntax.
- Preserve schema constants as stable serialized-data contracts.
- Give every normalized node independent nested `config` and `runtime` objects so mutation of one node cannot alter later defaults.
- Reject self-loop and duplicate edges during edge normalization.
- Keep edge colors semantic and stable because later UI code will render them by edge type.
- Do not introduce backend ownership for orchestrator behavior unless the browser cannot safely enforce the contract and the user explicitly approves backend work.

## Development Guidance

- Add focused `node:test` coverage under `tests/` when model behavior changes.
- Keep helpers small and reusable for later UI, storage, and runtime layers.
- If a later task adds child docs beneath this module, add a `Documentation Hierarchy` section here before those child docs land.

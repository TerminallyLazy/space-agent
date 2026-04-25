# AGENTS

## Purpose

`server/lib/agent_runners/` owns Orchestrator's server-side agent execution adapters.

## Ownership

- `service.js` validates normalized run requests, records in-memory run state, and dispatches provider adapters.
- `claude.js` adapts Claude Agent SDK.
- `openai.js` adapts OpenAI Agents SDK.
- `a2a.js` forwards compatible A2A tasks.

## Contracts

- Credentials arrive per run and are never written to disk.
- Provider events are normalized before reaching the graph runtime.
- Runner state is in-memory and supports graph-open activity, not browser-closed daemon orchestration.

## Development Guidance

Keep provider-specific SDK details in adapter files. Keep endpoint files thin.

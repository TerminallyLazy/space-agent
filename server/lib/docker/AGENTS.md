# AGENTS

## Purpose

`server/lib/docker/` owns Docker client setup and Docker operation helpers used by Orchestrator API endpoints.

## Ownership

- `client.js` resolves `DOCKER_HOST`, creates the Docker client, normalizes container summaries, checks `_admin` mutation permission, and exposes the Docker service methods.

## Contracts

- Browser code never accesses the Docker socket directly.
- API endpoints stay thin and delegate Docker behavior to this helper.
- Mutating container creation, removal, exec, and network operations require `_admin`.
- Managed containers are identified by `space.orchestrator.*` labels.
- Logs and exec output are bounded before they return to the browser.

## Development Guidance

Keep Docker policy here instead of duplicating it in endpoint files.

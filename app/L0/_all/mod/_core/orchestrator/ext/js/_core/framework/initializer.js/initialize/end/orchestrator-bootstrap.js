import { installOrchestratorRuntimeNamespace } from "/mod/_core/orchestrator/runtime-namespace.js";

export default async function orchestratorBootstrap() {
  if (!globalThis.space) return;
  if (globalThis.space.orchestrator) return;
  installOrchestratorRuntimeNamespace({ activeStore: null });
}

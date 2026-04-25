import {
  ORCHESTRATOR_ROOT_PATH,
  ORCHESTRATOR_SECRETS_DIR
} from "./constants.js";

const ORCHESTRATOR_SECRET_SCHEMA = "orchestrator-secret/v1";

export function buildCredentialPath(ref) {
  return `${ORCHESTRATOR_ROOT_PATH}${ORCHESTRATOR_SECRETS_DIR}${normalizePathSegment(ref)}.yaml`;
}

export async function writeCredential({ ref, provider, secret }, runtimeInput) {
  const runtime = ensureCredentialRuntime(runtimeInput);
  const normalizedRef = normalizePathSegment(ref);
  const normalizedProvider = normalizeInlineText(provider);

  if (!normalizedRef) {
    throw new Error("Credential ref is required.");
  }
  if (!normalizedProvider) {
    throw new Error("Credential provider is required.");
  }

  const encryptedSecret = await runtime.utils.userCrypto.encryptText(String(secret || ""));
  const payload = {
    schema: ORCHESTRATOR_SECRET_SCHEMA,
    ref: normalizedRef,
    provider: normalizedProvider,
    encryptedSecret,
    updatedAt: new Date().toISOString()
  };

  return runtime.api.fileWrite({
    path: buildCredentialPath(normalizedRef),
    content: runtime.utils.yaml.stringify(payload)
  });
}

export async function decryptCredentialForRun(ref, runtimeInput) {
  const runtime = ensureCredentialRuntime(runtimeInput);
  const normalizedRef = normalizePathSegment(ref);

  if (!normalizedRef) {
    throw new Error("Credential ref is required.");
  }

  const result = await runtime.api.fileRead(buildCredentialPath(normalizedRef));
  const payload = runtime.utils.yaml.parse(result?.content || "{}") || {};

  if (payload.schema !== ORCHESTRATOR_SECRET_SCHEMA) {
    throw new Error(`Unsupported credential schema for ${normalizedRef}.`);
  }

  return {
    provider: normalizeInlineText(payload.provider),
    secret: await runtime.utils.userCrypto.decryptText(payload.encryptedSecret || "")
  };
}

function ensureCredentialRuntime(runtimeInput) {
  const runtime = runtimeInput || globalThis.space;
  if (
    !runtime?.api ||
    typeof runtime.api.fileRead !== "function" ||
    typeof runtime.api.fileWrite !== "function" ||
    !runtime.utils?.yaml ||
    typeof runtime.utils.yaml.parse !== "function" ||
    typeof runtime.utils.yaml.stringify !== "function" ||
    !runtime.utils?.userCrypto ||
    typeof runtime.utils.userCrypto.encryptText !== "function" ||
    typeof runtime.utils.userCrypto.decryptText !== "function"
  ) {
    throw new Error("Orchestrator credentials require space.api file helpers, space.utils.yaml, and space.utils.userCrypto.");
  }

  return runtime;
}

function normalizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/gu, "")
    .replace(/\//gu, "-");
}

function normalizeInlineText(value) {
  return String(value || "").trim();
}

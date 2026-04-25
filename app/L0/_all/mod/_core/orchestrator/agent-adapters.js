const PROVIDER_BY_NODE_TYPE = Object.freeze({
  claude_agent: "anthropic",
  openai_agent: "openai",
  external_a2a_agent: "a2a",
  agent_zero: "agent_zero",
  space_agent: "space_agent"
});

export function getProviderForNode(node) {
  const type = String(node?.type || "").trim();
  const provider = PROVIDER_BY_NODE_TYPE[type];

  if (!provider) {
    throw new Error(`Unsupported agent node type: ${type || "unknown"}.`);
  }

  return provider;
}

export function buildRunRequest({ graphId, node, input, credential } = {}) {
  const provider = getProviderForNode(node);
  const credentialProvider = String(credential?.provider || "").trim();

  if (credentialProvider && credentialProvider !== provider) {
    throw new Error(`Credential provider ${credentialProvider} does not match node provider ${provider}.`);
  }

  return {
    graphId: normalizeInlineText(graphId),
    nodeId: normalizeInlineText(node?.id),
    provider,
    input,
    config: clonePlainObject(node?.config),
    runtime: clonePlainObject(node?.runtime),
    credential: credential ? { ...credential, provider: credentialProvider || provider } : null
  };
}

function normalizeInlineText(value) {
  return String(value || "").trim();
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clonePlainValue(value);
}

function clonePlainValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clonePlainValue(item)])
    );
  }
  return value;
}

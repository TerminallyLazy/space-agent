export async function* runClaudeAgent(request) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = request.credential.secret;
  try {
    const stream = query({
      prompt: request.input,
      options: {
        model: request.node.config?.model,
        allowedTools: request.node.config?.allowedTools || [],
        permissionMode: request.node.config?.permissionMode || "default",
        maxTurns: request.node.config?.maxTurns || 8
      }
    });
    for await (const message of stream) {
      yield { type: "provider_event", provider: "anthropic", payload: message };
    }
  } finally {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
}

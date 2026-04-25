export async function* runOpenAIAgent(request) {
  const { Agent, run, setDefaultOpenAIKey } = await import("@openai/agents");
  if (typeof setDefaultOpenAIKey === "function") {
    setDefaultOpenAIKey(request.credential.secret);
  } else {
    process.env.OPENAI_API_KEY = request.credential.secret;
  }
  const agent = new Agent({
    name: request.node.name || "Orchestrator Agent",
    instructions: request.node.config?.instructions || "",
    model: request.node.config?.model || "gpt-5.4"
  });
  const result = await run(agent, request.input);
  yield { type: "result", provider: "openai", payload: { finalOutput: result.finalOutput || "" } };
}

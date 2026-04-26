export async function* runOpenAIAgent(request) {
  const { Agent, run, setDefaultOpenAIClient, setDefaultOpenAIKey, setOpenAIAPI } = await import("@openai/agents");
  const apiKey = request.credential.secret;
  const rawBaseURL = String(request.credential.baseURL || request.node.config?.endpoint || "").trim();
  const baseURL = normalizeBaseURL(rawBaseURL);

  if (baseURL && typeof setDefaultOpenAIClient === "function") {
    const { default: OpenAI } = await import("openai");
    setDefaultOpenAIClient(new OpenAI({ apiKey, baseURL }));
    if (typeof setOpenAIAPI === "function") {
      setOpenAIAPI("chat_completions");
    }
  } else if (typeof setDefaultOpenAIKey === "function") {
    setDefaultOpenAIKey(apiKey);
  } else {
    process.env.OPENAI_API_KEY = apiKey;
  }

  const agent = new Agent({
    name: request.node.name || "Orchestrator Agent",
    instructions: request.node.config?.instructions || "",
    model: request.node.config?.model || "gpt-5.4"
  });
  const result = await run(agent, request.input);
  yield { type: "result", provider: "openai", payload: { finalOutput: result.finalOutput || "" } };
}

function normalizeBaseURL(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/chat\/completions\/?$/u, "").replace(/\/+$/u, "");
}

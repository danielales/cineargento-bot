// lib/bot/claude.ts
// Integración con Anthropic Claude API

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskClaudeParams {
  systemPrompt: string;
  messages: Message[];
}

export async function askClaude({
  systemPrompt,
  messages,
}: AskClaudeParams): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text as string;
}

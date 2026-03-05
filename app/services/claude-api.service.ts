/**
 * Claude API Service
 * Ported directly from ottomate - handles all Claude API interactions
 */

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  id: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call Claude API with a prompt
 */
export async function callClaude(
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<string> {
  const {
    maxTokens = 2000,
    temperature = 1.0,
    systemPrompt,
  } = options;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not found in environment variables");
    }

    const body: any = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error (${response.status}): ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data: ClaudeResponse = await response.json();

    if (!data.content || data.content.length === 0) {
      throw new Error("Claude API returned empty response");
    }

    const text = data.content[0].text;

    // Log token usage
    console.log(`✅ Claude API call completed - Input: ${data.usage.input_tokens}, Output: ${data.usage.output_tokens}`);

    return text;
  } catch (error) {
    console.error("❌ Claude API call failed:", error);
    throw error;
  }
}

const GEMINI_MODEL = "gemini-3-flash-preview";

export class LLMClient {
  constructor(private apiKey: string) {}

  private async makeRequest(
    prompt: string,
    generationConfig: Record<string, unknown>
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        ...generationConfig,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    const candidates = data?.candidates ?? [];
    if (!candidates.length) {
      throw new Error("Gemini response had no candidates.");
    }

    const text = candidates[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini response did not include text output.");
    }

    return text;
  }

  async generate(prompt: string): Promise<string> {
    return this.makeRequest(prompt, {});
  }

  async generateWithSchema<T>(
    prompt: string,
    responseSchema: Record<string, unknown>
  ): Promise<T> {
    const text = await this.makeRequest(prompt, {
      responseSchema: responseSchema,
      responseMimeType: "application/json",
    });

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response from Gemini: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

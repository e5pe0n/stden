import { type GenerateContentConfig, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { config } from "./config.js";
import type { Result } from "./types.js";

const ai = new GoogleGenAI({
  apiKey: config.googleGenAiApiKey,
});

const genaiRespSchema = z
  .object({
    candidates: z.array(
      z.object({
        content: z.object({
          parts: z.array(
            z.object({
              text: z.string(),
            }),
          ),
        }),
      }),
    ),
  })
  .passthrough();

const MODEL = "gemini-3.1-flash-lite";

export async function ask(
  input: string,
  genConfig?: GenerateContentConfig,
): Promise<Result<string>> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: input,
    ...(genConfig ? { config: genConfig } : {}),
  });

  // Validate response structure
  const parsedResponse = genaiRespSchema.safeParse(response);
  if (!parsedResponse.success) {
    return {
      success: false,
      error: new Error("Invalid response structure from AI", {
        cause: parsedResponse.error,
      }),
    };
  }

  const output = parsedResponse.data.candidates[0]?.content.parts[0]?.text;

  if (!output) {
    return {
      success: false,
      error: new Error("No text found in AI response"),
    };
  }

  return {
    success: true,
    value: output,
  };
}

/**
 * The same call constrained to JSON matching `schema`. Gemini is told the
 * shape up front rather than being asked for JSON in prose, so the reply needs
 * no fence-stripping or repair — but it is still parsed through the zod schema,
 * because a well-formed JSON document is not yet a document we can use.
 */
export async function askJson<T>(
  input: string,
  schema: z.ZodType<T>,
): Promise<Result<T>> {
  const res = await ask(input, {
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(schema),
  });
  if (!res.success) return res;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(res.value);
  } catch (error) {
    return {
      success: false,
      error: new Error("AI response was not valid JSON", { cause: error }),
    };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      success: false,
      error: new Error("AI response did not match the expected shape", {
        cause: parsed.error,
      }),
    };
  }

  return { success: true, value: parsed.data };
}

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Result } from "./types.js";
import fs from "node:fs";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
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

export async function ask(input: string): Promise<Result<string>> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: input,
  });

  fs.writeFileSync(
    `genai_response_${(new Date()).valueOf()}.json`,
    JSON.stringify(response, null, 2),
  );

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

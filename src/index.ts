import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
})

const en = "disseminate";

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents:`"${en}" meaning with example sentences, Japanese translation and synonyms.`
  });

  console.log("Response:", JSON.stringify(response, null, 2));
}

main().catch((error) => {
  console.error("Error:", error);
});

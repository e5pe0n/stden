import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs/promises";
import { z } from "zod";
import { insertMeaning } from "./db.js";

const ai = new GoogleGenAI({
	apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const PORT = process.env.PORT || 3000;

// Initialize Fastify server
const fastify = Fastify({
	logger: true,
});

// Register CORS plugin
await fastify.register(cors, {
	origin: true, // Allow all origins
});

const schema = z
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

// Implement POST endpoint at /api/v1
fastify.post("/api/v1", async (request, reply) => {
	const { text } = request.body as { text: string };

	if (!text) {
		return reply.code(400).send({ error: "Missing required field: text" });
	}

	try {
		const input = `"${text}" meaning with example sentences, Japanese translation and synonyms.`;
		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash",
			contents: input,
		});

		// Validate response structure
		const parsedResponse = schema.safeParse(response);
		if (!parsedResponse.success) {
			request.log.error("Invalid response structure:", parsedResponse.error);
			return reply.code(500).send({
				error: "Invalid response structure from AI",
			});
		}

		const output = parsedResponse.data.candidates[0]?.content.parts[0]?.text;

		if (!output) {
			return reply.code(500).send({ error: "No text found in AI response" });
		}

		await insertMeaning({
			word: text,
			input,
			output,
		});

		await fs
			.writeFile(
				`../logs/genai/${text}-${Date.now()}.json`,
				JSON.stringify(response, null, 2),
			)
			.catch((err) => {
				request.log.error("Failed to write log file:", err);
			});

		return {
			text: output,
		};
	} catch (error) {
		request.log.error(error);
		return reply
			.code(500)
			.send({ error: "An error occurred during processing" });
	}
});

// Start the server
const start = async () => {
	try {
		await fastify.listen({ port: Number(PORT), host: "0.0.0.0" });
		console.log(`Server listening on ${PORT}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();

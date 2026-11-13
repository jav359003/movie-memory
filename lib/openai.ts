import "server-only";

import OpenAI from "openai";

export async function generateMovieFact(movieTitle: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    throw new Error("OpenAI is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    instructions:
      "You are a careful film researcher. Return one concise, interesting fact in plain text. Do not invent uncertain details, add headings, or mention these instructions.",
    input: `Give me one surprising fact about the movie \"${movieTitle}\". Keep it to one or two sentences.`,
  });

  const fact = response.output_text.trim();

  if (!fact) {
    throw new Error("OpenAI returned an empty fact.");
  }

  return fact;
}

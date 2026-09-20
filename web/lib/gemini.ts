// Small wrapper around the Gemini API. Only the MAIN agent uses it.
// IMPORTANT: model names change. Copy the current name from the quickstart in Google AI Studio
// into GEMINI_MODEL in .env.local. If a call errors, compare this file to that quickstart first.
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/** Ask Gemini and get back parsed JSON. */
export async function askGeminiJSON<T>(prompt: string): Promise<T> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const text = (res.text ?? "{}").replace(/```json|```/g, "").trim();
  return JSON.parse(text) as T;
}

/** Ask Gemini and get back plain text. */
export async function askGeminiText(prompt: string): Promise<string> {
  const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
  return res.text ?? "";
}

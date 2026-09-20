// Small wrapper around the Gemini API so the rest of the app never touches the SDK directly.
//
// Setup:  npm install @google/genai
// Then put GEMINI_API_KEY (and optionally GEMINI_MODEL) in web/.env.local
//
// IMPORTANT: model names change. Copy the current model name from the quickstart in Google AI Studio
// and put it in GEMINI_MODEL. If a call errors, compare this file to that quickstart first.
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/** Ask Gemini and parse a JSON reply. */
export async function askGeminiJSON<T>(prompt: string): Promise<T> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const text = (res.text ?? "{}").replace(/```json|```/g, "").trim();
  return JSON.parse(text) as T;
}

/** Ask Gemini and return plain text. */
export async function askGeminiText(prompt: string): Promise<string> {
  const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
  return res.text ?? "";
}

import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found. Gemini features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCreativeName = async (description: string): Promise<string> => {
  const client = getClient();
  if (!client) return `audio_clip_${Date.now()}`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, creative, snake_case filename (max 25 chars, no extension) for an audio clip described as: "${description}". Return ONLY the filename string, nothing else.`,
    });
    
    return response.text?.trim().replace(/\s/g, '_') || `audio_clip_${Date.now()}`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `audio_clip_${Date.now()}`;
  }
};
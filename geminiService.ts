import { GoogleGenAI, Type } from "@google/genai";

// Standard encoding helper
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Standard decoding helper
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * Fixed the "Data read, but end of buffer not reached" error by ensuring
 * we never use the browser's native decodeAudioData for raw PCM.
 * Also handles byte alignment for Int16Array conversion.
 */
export async function decodeRawPcm(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure the byte length is even for 16-bit PCM (2 bytes per sample)
  // This prevents the "Data read, but end of buffer not reached" or "Buffer length must be a multiple of 2" errors.
  var usableByteLength = data.byteLength - (data.byteLength % 2);
  
  // Create a view of the buffer using the correct offset and aligned length
  var dataInt16 = new Int16Array(data.buffer, data.byteOffset, usableByteLength / 2);
  var frameCount = dataInt16.length / numChannels;
  var buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (var channel = 0; channel < numChannels; channel++) {
    var channelData = buffer.getChannelData(channel);
    for (var i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const getGeminiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" = "1:1") => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: { aspectRatio }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from API");
};

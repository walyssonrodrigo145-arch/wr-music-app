import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    console.log("Testing Gemini API...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("API Key is missing in .env");
      process.exit(1);
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage("Hello, are you there?");
    console.log("Success:", result.response.text());
  } catch (error: any) {
    console.error("Exact Gemini Error:", error);
    if (error.status) console.error("Status:", error.status);
    if (error.statusText) console.error("StatusText:", error.statusText);
    if (error.response) console.error("Response:", error.response);
  } finally {
    process.exit(0);
  }
}

main();

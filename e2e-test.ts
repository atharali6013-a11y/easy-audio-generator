import { generateConversationScript } from './src/lib/llm';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const text = "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.";
  
  try {
    console.log("Generating conversation script...");
    const script = await generateConversationScript(text);
    console.log("Success!");
    console.log(JSON.stringify(script, null, 2));
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
}

main();

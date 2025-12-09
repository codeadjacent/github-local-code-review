import { runAnalysis } from "./lib.js";
import dotenv from "dotenv";
import * as readline from 'readline';
import path from "path";

// Load .env from current directory AND project root
dotenv.config(); // CWD (packages/mcp-server)
dotenv.config({ path: path.join(process.cwd(), "../../.env") }); // Root (.env)

function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function localRun() {
    let prUrl = process.argv[2];

    if (!prUrl) {
        console.log("No PR URL provided.");
        prUrl = await askQuestion("Please enter the GitHub PR URL: ");
    }

    if (!prUrl) {
        console.error("Error: URL is required.");
        process.exit(1);
    }

    console.log(`\n--- Starting Local Run for: ${prUrl} ---\n`);

    if (!process.env.OPENAI_API_KEY) {
        console.warn("⚠️  OPENAI_API_KEY is missing. Please check your .env file.");
    }
    if (!process.env.GITHUB_TOKEN) {
        console.warn("⚠️  GITHUB_TOKEN is missing. Rate limits might apply.");
        console.log("Available Env Keys:", Object.keys(process.env).sort());
    }

    try {
        const result = await runAnalysis(prUrl);
        console.log("\n--- Analysis Result ---\n");
        console.log(result);
        console.log("\n--- End of Result ---\n");
    } catch (error) {
        console.error("Execution Failed:", error);
    }
}

localRun();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FrameworkDetector } from "./detector.js";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import path from "path";

// Load .env from current directory AND project root
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

// Create server instance
export const server = new McpServer({
    name: "code-review-bot",
    version: "1.0.0",
});

const detector = new FrameworkDetector();

// Parse GitHub URL
function parsePrUrl(url: string) {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = url.match(regex);
    if (!match) throw new Error("Invalid GitHub PR URL");
    return { owner: match[1], repo: match[2], pull_number: parseInt(match[3]) };
}

// Fetch Real PR Data
export async function fetchPRData(prUrl: string) {
    console.error(`Fetching PR data for ${prUrl}...`);

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { owner, repo, pull_number } = parsePrUrl(prUrl);

    // 1. Get PR Details for Head SHA
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number });
    const headSha = pr.head.sha;

    // 2. Get Changed Files
    const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number });

    const fileContents = await Promise.all(files.map(async (f) => {
        // Skip deleted files or binaries
        if (f.status === 'removed') return null;

        // For simplicity in this demo, accessing raw URL or using API to get blob
        // Using raw_url is easiest for public, but API blob is better for private
        // We will try to get content from patch (diff) or fetch content

        let content = f.patch || "";

        // If we want full file content, we need to fetch it.
        // Small files optimization:
        try {
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: f.filename,
                ref: headSha
            }) as any;

            if (fileData.content && fileData.encoding === 'base64') {
                content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            }
        } catch (e) {
            console.warn(`Could not fetch full content for ${f.filename}, using patch.`);
        }

        return {
            filename: f.filename,
            content: content
        };
    }));

    // 3. Get package.json
    let packageJson = {};
    try {
        const { data: pkgData } = await octokit.repos.getContent({
            owner,
            repo,
            path: "package.json",
            ref: headSha
        }) as any;

        if (pkgData.content && pkgData.encoding === 'base64') {
            const jsonStr = Buffer.from(pkgData.content, 'base64').toString('utf-8');
            packageJson = JSON.parse(jsonStr);
        }
    } catch (e) {
        console.warn("No package.json found or readable.");
    }

    return {
        packageJson,
        files: fileContents.filter(f => f !== null) as Array<{ filename: string, content: string }>
    };
}

// Core Logic Export for Lambda / Direct usage
export async function runAnalysis(prUrl: string) {
    const data = await fetchPRData(prUrl);
    const strategy = detector.detect(data.packageJson);
    console.log(`Detected Framework Strategy: ${strategy.name}`);

    const instructions = strategy.getReviewInstructions();
    const staticComments = await strategy.analyze({ prUrl: prUrl, ...data });

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not set");
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `
Role: Code Reviewer
Strategy: ${strategy.name}
Instructions: ${instructions}
Static Analysis Issues: ${JSON.stringify(staticComments, null, 2)}
    `.trim();

    const userPrompt = `
Review the following files:
${data.files.map(f => `--- ${f.filename} ---\n${f.content}`).join("\n")}

Provide a JSON array of review comments.
    `.trim();

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        model: "gpt-4o",
    });

    return completion.choices[0].message.content || "No response from AI";
}

server.tool(
    "analyze_pr",
    { pr_url: z.string().url() },
    async ({ pr_url }) => {
        try {
            const responseText = await runAnalysis(pr_url);
            return {
                content: [{
                    type: "text",
                    text: responseText
                }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `AI Error: ${error.message}` }]
            };
        }
    }
);

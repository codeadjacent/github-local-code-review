import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FrameworkDetector } from "./detector.js";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import { Logger } from "./log.js";
import dotenv from "dotenv";
import path from "path";

// Load .env from current directory AND project root
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

// Create server instance
export const server = new McpServer({
    name: "code-review",
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

    let unuzed;
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
            content: content,
            patch: f.patch // Include the diff/patch
        };
    }));

    // 3. Get package.json
    let packageJson = {};
    try {
        const { data: pkgData } = await octokit.repos.getContent({
            owner,
            repo,
            path: "package.json",
            // ref: headSha // Removed to fetch from default branch (main/master)
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
        files: fileContents.filter(f => f !== null) as Array<{ filename: string, content: string, patch?: string }>
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

Output specific review comments in valid JSON format. 
Return a SINGLE JSON array of objects.
Each object must have:
- "filename": (string) exact file path
- "line": (number) the line number to comment on (must be > 0). If the issue is general, pick the first relevant line.
- "comment": (string) the markdown text of the comment

Example:
[
  { "filename": "src/index.ts", "line": 15, "comment": "Avoid using any here." }
]
    `.trim();

    const userPrompt = `
Review the following files:
${data.files.map(f => `--- ${f.filename} ---
${f.patch ? `Diff:\n${f.patch}\n` : ''}
Full Content:
${f.content}`).join("\n")}
    `.trim();

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    // --- Logging ---
    const logger = new Logger();
    logger.logRequest(systemPrompt, userPrompt);
    // ---------------

    const completion = await openai.chat.completions.create({
        messages: messages as any,
        model: "gpt-4o",
        response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0].message.content || "[]";

    // --- Logging Result ---
    logger.logResult(rawContent);
    // ---------------------

    let comments: Array<{ filename: string, line: number, comment: string }> = [];

    try {
        const parsed = JSON.parse(rawContent);
        // Handle if the model returns { "comments": [...] } or just [...]
        comments = Array.isArray(parsed) ? parsed : (parsed.comments || []);
    } catch (e) {
        console.error("Failed to parse AI response as JSON", rawContent);
        throw new Error("AI returned invalid JSON format");
    }

    if (comments.length === 0) {
        return "No issues found by AI.";
    }

    // Submit Draft Review (Pending)
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { owner, repo, pull_number } = parsePrUrl(prUrl);

    // Filter comments to ensure they map to valid files
    // Note: In a real app, we'd verify line numbers match the diff. 
    // GitHub API might error if the line isn't part of the diff.
    // For this prototype, we'll try best effort.

    const reviewComments = comments.map(c => ({
        path: c.filename,
        line: c.line,
        body: c.comment
    }));

    try {
        await octokit.pulls.createReview({
            owner,
            repo,
            pull_number,
            comments: reviewComments,
            // event: undefined // defaults to PENDING (Draft)
        });
        return `Draft review created with ${reviewComments.length} comments. check https://github.com/${owner}/${repo}/pull/${pull_number}`;
    } catch (e: any) {
        console.error("Failed to create GitHub review:", e);
        // Fallback if API fails (e.g. invalid line numbers)
        return `AI Found issues but could not post to GitHub:\n${JSON.stringify(comments, null, 2)}\nError: ${e.message}`;
    }
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

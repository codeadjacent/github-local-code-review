import fs from 'fs';
import path from 'path';

export class Logger {
    private logsDir: string;
    private runDir: string | null = null;

    constructor() {
        this.logsDir = path.join(process.cwd(), 'logs');
    }

    private ensureDirs() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir);
        }
    }

    startRun() {
        this.ensureDirs();
        const now = new Date();
        const timestamp = now.toISOString().split('.')[0].replace(/:/g, '-');
        this.runDir = path.join(this.logsDir, timestamp);
        if (!fs.existsSync(this.runDir)) {
            fs.mkdirSync(this.runDir);
        }
        console.log(`Run logs initialized at ${this.runDir}`);
        return this.runDir;
    }

    logRequest(systemPrompt: string, userPrompt: string) {
        if (!this.runDir) this.startRun();

        try {
            if (this.runDir) {
                fs.writeFileSync(path.join(this.runDir, 'system.md'), systemPrompt);
                fs.writeFileSync(path.join(this.runDir, 'user.md'), userPrompt);
            }
        } catch (e) {
            console.error("Failed to save request logs:", e);
        }
    }

    logResult(content: string) {
        if (!this.runDir) return;

        try {
            fs.writeFileSync(path.join(this.runDir, 'result.md'), content);
            console.log(`Result log saved to ${this.runDir}`);
        } catch (e) {
            console.error("Failed to save result log:", e);
        }
    }
}

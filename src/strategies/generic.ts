import { FrameworkStrategy, ReviewContext, ReviewComment } from "./types.js";

export class GenericStrategy implements FrameworkStrategy {
    id = "generic";
    name = "Generic";

    matches(pkg: any): boolean {
        return true;
    }

    getReviewInstructions(): string {
        return `
        Perform a spell check on the codebase.
    `.trim();
    }

    async analyze(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];
        // Basic regex checks can go here
        return comments;
    }
}


export interface ReviewContext {
    prUrl: string;
    files: Array<{
        filename: string;
        content: string;
        patch?: string;
    }>;
    packageJson: any;
}

export interface ReviewComment {
    filename: string;
    line: number;
    message: string;
    suggestion?: string;
    severity: "INFO" | "WARNING" | "BLOCKING";
}

export interface FrameworkStrategy {
    id: string;
    name: string;

    /**
     * Returns true if this strategy applies to the given package.json
     */
    matches(packageJson: any): boolean;

    /**
     * Returns the system prompt instructions specific to this framework
     */
    getReviewInstructions(): string;

    /**
     * Optional: Run static analysis / regex checks
     */
    analyze(context: ReviewContext): Promise<ReviewComment[]>;
}

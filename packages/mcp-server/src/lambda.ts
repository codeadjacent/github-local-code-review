import { Handler } from 'aws-lambda';
import { runAnalysis } from './lib.js';

export const handler: Handler = async (event) => {
    console.log("Review Agent triggered", JSON.stringify(event, null, 2));

    // Event validation: handling direct invocation or SQS/EventBridge in future
    const prUrl = event.prUrl || event.detail?.prUrl;

    if (!prUrl) {
        throw new Error("No prUrl provided in event");
    }

    try {
        const result = await runAnalysis(prUrl);
        // TODO: Post result to GitHub (requires GitHub token)
        // For now, just log it or return it
        console.log("Review Result:", result);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Review generated", result }),
        };
    } catch (error: any) {
        console.error("Analysis failed", error);
        throw error;
    }
};

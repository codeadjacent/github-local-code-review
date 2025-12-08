import { FrameworkStrategy, ReviewContext, ReviewComment } from "./types.js";

export class AngularModernStrategy implements FrameworkStrategy {
    id = "angular-modern";
    name = "Angular (Modern)";

    matches(pkg: any): boolean {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        return !!deps["@angular/core"];
    }

    getReviewInstructions(): string {
        return `
You are an expert in modern Angular (v16+).
Rules:
1. Enforce usage of Signals over RxJS BehaviorSubjects for synchronous state.
2. Check for Standalone Components (standalone: true).
3. Ensure 'ControlFlow' syntax (@if, @for) is used instead of *ngIf / *ngFor.
4. If this is a hybrid app (ngUpgrade), ensure downgraded components are typed correctly.
    `.trim();
    }

    async analyze(context: ReviewContext): Promise<ReviewComment[]> {
        return [];
    }
}

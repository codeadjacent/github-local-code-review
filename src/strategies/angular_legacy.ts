import { FrameworkStrategy, ReviewContext, ReviewComment } from "./types.js";

export class AngularLegacyStrategy implements FrameworkStrategy {
    id = "angular-legacy";
    name = "AngularJS (Legacy)";

    matches(pkg: any): boolean {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        return deps["angular"] && !deps["@angular/core"];
    }

    getReviewInstructions(): string {
        return `
You are an expert in AngularJS (v1.x).
Key Migration Context: We are migrating to Angular 18+.
Rules:
1. Identify any new usage of '$scope'. Suggest using 'controllerAs' syntax or pure ES6 classes if possible.
2. Flag any manual DOM manipulation (jQuery).
3. If a new component is created, check if it follows the .component() syntax, NOT .directive() with link functions.
4. Warn if 'ng-controller' is used in templates (prefer component-based routing).
    `.trim();
    }

    async analyze(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];
        // Basic regex checks can go here
        return comments;
    }
}

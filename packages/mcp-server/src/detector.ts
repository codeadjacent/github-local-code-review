import { FrameworkStrategy } from "./strategies/types.js";
import { AngularLegacyStrategy } from "./strategies/angular_legacy.js";
import { AngularModernStrategy } from "./strategies/angular_modern.js";

export class FrameworkDetector {
    private strategies: FrameworkStrategy[] = [
        new AngularModernStrategy(),
        new AngularLegacyStrategy(),
    ];

    detect(packageJson: any): FrameworkStrategy {
        for (const strategy of this.strategies) {
            if (strategy.matches(packageJson)) {
                return strategy;
            }
        }

        return {
            id: "generic",
            name: "Generic JS/TS",
            matches: () => true,
            getReviewInstructions: () => "Review for general code quality, security, and performance.",
            analyze: async () => []
        };
    }
}

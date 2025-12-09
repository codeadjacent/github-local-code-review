import { FrameworkStrategy } from "./strategies/types.js";
import { AngularLegacyStrategy } from "./strategies/angular_legacy.js";
import { AngularModernStrategy } from "./strategies/angular_modern.js";
import { GenericStrategy } from "./strategies/generic.js";

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

        return new GenericStrategy();
    }
}

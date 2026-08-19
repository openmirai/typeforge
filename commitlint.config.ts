import { RuleConfigSeverity } from "@commitlint/types";
import type { UserConfig } from "@commitlint/types";

const commitLintConfig: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-length": [RuleConfigSeverity.Warning, "always", 100],
    "body-max-line-length": [RuleConfigSeverity.Warning, "always", 100],
    "header-max-length": [RuleConfigSeverity.Warning, "always", 100],
  },
};

export default commitLintConfig;

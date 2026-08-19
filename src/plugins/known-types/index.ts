import type { IRSchema } from "../../parser/types";
import { loadUserKnownTypes } from "./load";
import type { KnownTypeMatch, KnownTypeRule } from "./types";

export type {
  DeclarativeKnownTypeRule,
  KnownTypeMatch,
  KnownTypeRule,
} from "./types";
export { loadUserKnownTypes } from "./load";
export { matchesDeclarativeRule, matchesExactProperties } from "./matchers";

export function loadKnownTypeRules(
  cwd: string,
  apiRoot: string
): Array<KnownTypeRule> {
  return loadUserKnownTypes(cwd, apiRoot);
}

export function matchKnownType(
  schema: IRSchema,
  components: Record<string, IRSchema>,
  rules: Array<KnownTypeRule>
): KnownTypeMatch | undefined {
  for (const rule of rules) {
    if (rule.matcher(schema, components)) {
      return {
        importPath: rule.importPath,
        rule,
        typeName: rule.typeName,
      };
    }
  }
  return undefined;
}

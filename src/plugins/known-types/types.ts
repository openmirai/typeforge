import type { IRSchema } from "../../parser/types";

export interface KnownTypeRule {
  name: string;
  typeName: string;
  importPath: string | null;
  matcher: (schema: IRSchema, components: Record<string, IRSchema>) => boolean;
}

/** Declarative rule loaded from user known-types.ts (no functions). */
export interface DeclarativeKnownTypeRule {
  name: string;
  typeName: string;
  importPath?: string | null;
  exactProperties?: Array<string>;
  requireProperties?: Array<string>;
  excludeProperties?: Array<string>;
  maxPropertyCount?: number;
}

export interface KnownTypeMatch {
  rule: KnownTypeRule;
  typeName: string;
  importPath: string | null;
}

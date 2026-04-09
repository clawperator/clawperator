export interface CliFlagAliasSpec {
  canonical: string;
  aliases: readonly string[];
}

export function expandSupportedFlagsWithAliases(
  supportedFlags: readonly string[],
  aliasSpecs: readonly CliFlagAliasSpec[],
): string[] {
  const all = new Set(supportedFlags);
  for (const spec of aliasSpecs) {
    all.add(spec.canonical);
    for (const alias of spec.aliases) {
      all.add(alias);
    }
  }
  return [...all];
}

export function normalizeCliFlagAliases(
  rest: string[],
  aliasSpecs: readonly CliFlagAliasSpec[],
): string[] {
  if (aliasSpecs.length === 0) {
    return rest;
  }

  const aliasToCanonical = new Map<string, string>();
  for (const spec of aliasSpecs) {
    for (const alias of spec.aliases) {
      aliasToCanonical.set(alias, spec.canonical);
    }
  }

  return rest.map((token) => aliasToCanonical.get(token) ?? token);
}

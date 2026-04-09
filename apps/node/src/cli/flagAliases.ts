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

export function normalizeCliFlagAliasesBeforeForwardSeparator(
  argv: string[],
  aliasSpecs: readonly CliFlagAliasSpec[],
  flagValueArity: ReadonlyMap<string, number> = new Map<string, number>(),
): string[] {
  let forwardIdx = -1;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--") {
      continue;
    }
    const previous = argv[i - 1];
    if (
      previous !== undefined
      && flagValueArity.get(previous) === 1
      && argv[i + 1] !== undefined
    ) {
      // `--` immediately after a one-value flag escapes a literal value token.
      i += 1;
      continue;
    }
    forwardIdx = i;
    break;
  }

  if (forwardIdx < 0) {
    return normalizeCliFlagAliases(argv, aliasSpecs);
  }

  const prefix = normalizeCliFlagAliases(argv.slice(0, forwardIdx), aliasSpecs);
  return [...prefix, ...argv.slice(forwardIdx)];
}

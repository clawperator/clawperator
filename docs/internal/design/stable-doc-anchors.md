# Stable Docs Anchors

Public docs links should target explicit anchors, not incidental heading slugs.
Use HTML anchors because the current MkDocs config does not enable an explicit
heading-id extension.

## Rules

- Put anchors on the canonical owner page for the concept.
- Use canonical API names, not aliases.
- Keep generated command anchors in the CLI generator.
- Add authored anchors only where a page owns the concept.
- Do not add broad prose autolinking. Link deliberately from generated metadata
  or from high-signal authored references.

## Patterns

| Concept | Pattern | Example |
| --- | --- | --- |
| CLI command | `command-<name>` | `command-snapshot` |
| CLI subcommand | `command-<name>-<subcommand>` | `command-recording-export` |
| Execution action type | `action-<type>` | `action-click` |
| Selector field | `selector-field-<field>` | `selector-field-resource-id` |
| Selector CLI flag | `selector-flag-<flag>` | `selector-flag-id` |
| Error code | `error-<lowercase-code>` | `error-node-not-found` |
| Result envelope field | `result-envelope-<field>` | `result-envelope-command-id` |
| Serve endpoint | `endpoint-<method>-<path>` | `endpoint-post-execute` |
| MCP tool | `mcp-tool-<name>` | `mcp-tool-configure` |
| Setup step | `setup-step-<slug>` | `setup-step-install-operator-apk` |

Normalize anchor components to lowercase kebab case. Drop leading dashes from
CLI flags and replace route parameters such as `:skillId` with the parameter
name, for example `endpoint-post-skills-skill-id-run`.

## Ownership

Generated pages may route readers to authored detail pages, but the generated
page does not become the behavior owner. The docs-owned ownership manifest under
`sites/docs/` records these routes so future docs generation can stay explicit
and reviewable.

# Clawperator Release Notes Strategy & Implementation Plan

## Objective
Automate the generation, formatting, and distribution of release notes across the Clawperator project (Android App, Node API, Documentation). Provide a configurable agent skill to generate historical and current release notes, and expose the current version transparently on the documentation website.

## Strategy Summary
1.  **Unified Source of Truth:** The root `CHANGELOG.md` will contain all release notes, formatted according to "Keep a Changelog" principles, with changes categorized by product surface.
2.  **Configurable LLM Generation:** A new skill (`release-notes-generate`) will gather git commits between any two references, categorize them, and instruct an LLM to draft the release notes.
3.  **Automated Distribution:** The GitHub Release action will extract its body from `CHANGELOG.md`, and the documentation site will expose both the current version number and the full changelog.

---

## Component Design

### 1. New Agent Skill: `release-notes-generate`
Located at: `.agents/skills/release-notes-generate/`

This skill relies on the agent's *intrinsic LLM reasoning* combined with a deterministic helper script to fetch git data. The agent executes the script, reads the raw commits, and uses its LLM to synthesize the final markdown.

*   **Helper Script (`scripts/gather_commits.py`)**
    *   **Arguments:** `--start-ref` (e.g., `v0.1.0`), `--end-ref` (e.g., `v0.2.0` or `HEAD`). If omitted, defaults to the last tag and `HEAD`.
    *   **Execution:** Runs `git log` between the refs.
    *   **Categorization:** Analyzes file paths in each commit to group them:
        *   `apps/node/**` -> Node API
        *   `docs/**`, `sites/**` -> Documentation & Website
        *   `apps/android/**` -> Android App
        *   Everything else -> Core / General
    *   **Metadata:** Extracts the commit date of the `--end-ref` (or today's date if `HEAD`).
    *   **Output:** A structured JSON or Markdown digest of categorized commits and the release date.
*   **Skill Instructions (`SKILL.md`)**
    *   Defines exactly what the agent should do when invoked.
    *   **Step 1:** Guides the agent to invoke `gather_commits.py` to get the raw data.
    *   **Step 2 (LLM Synthesis):** Explicitly prompts the agent's LLM to read the script's output, ignore skills/chore/refactor noise, and synthesize the remaining commits into user-friendly release notes.
    *   **Step 3 (Formatting):** Enforces the standard format: `## [<version>] - <YYYY-MM-DD>`.
    *   **Step 4 (Writing):** Directs the agent to safely insert the generated block into `CHANGELOG.md`, maintaining chronological order or replacing the `[Unreleased]` block.

### 2. Root `CHANGELOG.md` Updates
*   Maintain the standard [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
*   Within each version block, implement surface-level sub-headings in a specific order: Node API & CLI, Documentation & Website, and Android Operator APK.

### 3. Documentation Site Versioning & Changelog
*   **Version Variable:** Add `extra: version: "<current_version>"` to `sites/docs/mkdocs.yml`.
*   **Version Display:** Modify `sites/docs/overrides/main.html` to inject the version number (e.g., `v{{ config.extra.version }}`) into the header or footer of the Terminal theme.
*   **Changelog Integration:** Map the root `CHANGELOG.md` into the `mkdocs.yml` navigation structure (e.g., under "Reference -> Release Notes") so it is publicly viewable. Note: This may require mapping it in `sites/docs/source-map.yaml` to generate a copy into `sites/docs/docs/`.

### 4. Integration with Existing Release Workflows
*   **GitHub Action (`.github/workflows/release-apk.yml`)**:
    *   Replace the hardcoded `release-notes.md` creation step.
    *   Add a step to parse `CHANGELOG.md` and extract the specific block corresponding to `GITHUB_REF_NAME` (the tag being released).
    *   Use this extracted block as the `body_path` for the GitHub Release.
*   **Skill: `release-update-published-version`**:
    *   Update `scripts/update_published_version.py` to also bump the `extra: version:` value in `sites/docs/mkdocs.yml` when the public docs are updated.

---

## Agent Invocation Model (AGENTS.md & Workflow)

Skills do not make LLM calls themselves; they are instructions *for* the agent (the LLM). To make this robust:
1.  **Agent Trigger:** The user or the `release-orchestrator` skill will prompt an agent: "Run the `release-notes-generate` skill for version X".
2.  **Skill Context:** The agent reads `.agents/skills/release-notes-generate/SKILL.md`. This file acts as the "system prompt" for the current task.
3.  **Data Fetching:** The agent executes `gather_commits.py` using a bash tool.
4.  **LLM Processing:** The script outputs raw commit subjects and bodies. The agent receives this in its context window. The `SKILL.md` instructions guide the agent on how to filter, group, and rewrite this raw data into the target format.
5.  **File Modification:** The agent uses its file-editing tools (`replace` or `write_file`) to apply the generated notes to `CHANGELOG.md`.

This relies entirely on the agent's innate capabilities to execute shell commands, synthesize text, and edit files, orchestrated by the strict instructions in `SKILL.md`.

---

## Target Release Notes Format

The LLM will be instructed to synthesize commits into human-readable bullet points, grouping related PRs and filtering out internal chore/refactor noise. The generated release notes should strictly follow this format (note the specific order of sections and exclusion of skills):

```markdown
## [<version>] - <YYYY-MM-DD>

This release introduces... (High-level summary of the release)

### 🤖 Node API & CLI
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...

### 📚 Documentation & Website
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...

### 📱 Android Operator APK
- **Added:** ...
- **Fixed:** ...
```

---

## Recommended Execution Order

1.  **Implement the `release-notes-generate` skill**: Write the Python helper script and the `SKILL.md`.
2.  **Backfill / Test**: Use the new skill to generate release notes for the current unreleased changes, validating the categorization and formatting.
3.  **Update Docs Site**: Apply changes to `mkdocs.yml` and `main.html` to display the version number, and expose `CHANGELOG.md` to the generated documentation. Update `docs-generate` mapping if necessary.
4.  **Update Release Tooling**: Modify the GitHub Action and the `release-update-published-version` skill to complete the automation loop.

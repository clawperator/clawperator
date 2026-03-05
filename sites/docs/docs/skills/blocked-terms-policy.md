# Blocked Terms Policy (Local PII Guard)

This repository supports a local pre-commit guard to reduce accidental commits of sensitive strings (for example personal names, device serials, or internal identifiers).

## Why this exists

- Git history is hard to clean once sensitive text is committed.
- LLM-assisted workflows can unintentionally propagate local values into code/docs.
- A local denylist catches obvious leaks before commit.

## Shared local config path

When `clawperator` and `clawperator-skills` are checked out side by side, both use the same optional sibling config directory:

- `../.clawcave/` (relative to each repo root)

Expected files:

- `../.clawcave/blocked-terms.txt`
- `../.clawcave/pre-commit-blocked-terms.sh`

Bootstrap:

```bash
mkdir -p ../.clawcave
cp ./blocked-terms.txt.example ../.clawcave/blocked-terms.txt
```

## `blocked-terms.txt` format

- One term per line.
- Case-insensitive matching.
- Blank lines are ignored.
- Lines starting with `#` are comments.
- Use plain literal strings (no regex syntax required).

Example:

```text
# Personal identifiers
full legal name
device-serial-1234
family-member-name
```

## Install hooks in each repo

From each repo root:

```bash
./scripts/install_blocked_terms_hook.sh
```

This writes `.git/hooks/pre-commit` to call the shared hook script.
If `../.clawcave/` is missing, the hook will warn and skip checks (non-blocking).

## What the hook checks

- Scans staged added lines (`git diff --cached`).
- Matches blocked terms literally (`grep -F -i`).
- Reports offending term + file.
- Blocks commit on match.
- Ignores the blocked-terms file itself.

## Scan already-committed content

Use:

```bash
./scripts/scan_blocked_terms.sh
```

Modes:

- Default: scans current `HEAD` tree.
- `--history`: scans all reachable commits (slower).
- `--terms-file <path>`: use alternate terms file.

## Scope and limitations

- This is a **local developer control** by default.
- `.git/hooks` is not versioned; each clone/user must install it.
- For organization-wide enforcement, add CI checks and/or use a shared hooks path policy.

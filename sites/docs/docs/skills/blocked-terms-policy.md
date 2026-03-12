# Blocked Terms Policy (Local PII Guard)

This repository supports a local pre-commit guard to reduce accidental commits of sensitive strings (for example personal names, device serials, or internal identifiers).

## Why this exists

- Git history is hard to clean once sensitive text is committed.
- LLM-assisted workflows can unintentionally propagate local values into code/docs.
- A local denylist catches obvious leaks before commit.

## Shared local config path

`clawperator` and `clawperator-skills` both look for an optional user-scoped config directory at:

- `~/.clawperator/`

Expected files:

- `~/.clawperator/blocked-terms.txt`
- `~/.clawperator/pre-commit-blocked-terms.sh`

Bootstrap:

```bash
mkdir -p ~/.clawperator
cp ./blocked-terms.txt.example ~/.clawperator/blocked-terms.txt
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

If a repo includes the helper installer script, run it from that repo root:

```bash
./scripts/install_blocked_terms_hook.sh
```

Today that helper lives in `clawperator-skills/scripts/install_blocked_terms_hook.sh`.
For repos that do not ship the helper, create `.git/hooks/pre-commit` to exec `~/.clawperator/pre-commit-blocked-terms.sh`.

The helper writes `.git/hooks/pre-commit` to call the shared hook script.
If `~/.clawperator/` is missing, the hook will warn and skip checks (non-blocking).

## What the hook checks

- Scans staged added lines (`git diff --cached`).
- Matches blocked terms literally (`grep -F -i`).
- Reports offending term + file.
- Blocks commit on match.
- Ignores the blocked-terms file itself.

## Scan already-committed content

If you have the helper script available, use:

```bash
./scripts/scan_blocked_terms.sh
```

Today that scanner lives in `clawperator-skills/scripts/scan_blocked_terms.sh`.

Modes:

- Default: scans current `HEAD` tree.
- `--history`: scans all reachable commits (slower).
- `--terms-file <path>`: use alternate terms file.

## Scope and limitations

- This is a **local developer control** by default.
- `.git/hooks` is not versioned; each clone/user must install it.
- For organization-wide enforcement, add CI checks and/or use a shared hooks path policy.

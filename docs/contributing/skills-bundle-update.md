# Updating the Skills Bundle

The skills bundle at `https://clawperator.com/install/clawperator-skills.bundle` is a static file committed to this repo at `sites/landing/public/install/clawperator-skills.bundle`. It is not auto-synced from the `clawperator-skills` repo - it must be manually regenerated and committed here when the skills repo changes.

## When to update

Regenerate the bundle any time `../clawperator-skills` is updated with changes that should reach users:

- skill script fixes (e.g. default receiver package changes)
- new skills added
- skill metadata or registry changes

## How to update

From the repo root (requires `../clawperator-skills` to be checked out and up to date):

```bash
./scripts/bundle_skills.sh
```

This reads from `../clawperator-skills` and writes the updated bundle to `sites/landing/public/install/clawperator-skills.bundle`.

Then commit and open a PR:

```bash
git add sites/landing/public/install/clawperator-skills.bundle
git commit -m "chore: update skills bundle"
```

Once merged to `main`, Cloudflare deploys the updated bundle automatically. No manual deploy step is needed.

## What the installer does with it

`install.sh` runs `clawperator skills install`, which clones the bundle to `~/.clawperator/skills/`. A user who installs after the bundle is updated will get the new skills. Existing installs can update with `clawperator skills update`.

## Verification

After the bundle is deployed, confirm the new revision is live:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
clawperator skills list
```

The skill versions in the output should reflect the latest `../clawperator-skills` commits.

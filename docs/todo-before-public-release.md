# TODO Before Public Release

This checklist tracks changes required before the public launch.

## Skills Repo Access

- [ ] Make `https://github.com/clawpilled/clawperator-skills` publicly accessible.
- [ ] Re-run `scripts/install.sh` on a clean macOS machine and verify no GitHub credential prompt appears.
- [ ] Re-run `scripts/install.sh` on a clean Linux machine and verify non-interactive skills setup works.

## Install Script Follow-up

- [ ] Update `scripts/install.sh` to use anonymous, non-interactive git clone/pull for the public skills repo.
- [ ] Remove or update the inline note in `setup_skills()` about private-repo credential prompts.
- [ ] Confirm `skills-registry.json` path still matches the skills repo layout.

## Docs Follow-up

- [ ] Add a note to public docs that installer should not require GitHub auth once skills repo is public.
- [ ] Verify all install docs match final install behavior (`clawperator skills install` vs direct git clone, depending on final implementation).

# Project Agent Notes

## Core rule

- Stability is the first priority. Keep changes narrowly scoped and do not alter unrelated systems.
- Never store API keys, access tokens, payment details, or other credentials in the repository.
- Before changing or diagnosing MiniMax voice cloning, read `MINIMAX_VOICE_CLONE_RUNBOOK.md`.

## Release rule

- Check the branch and worktree before committing.
- Do not commit local Supabase CLI binaries or generated configuration files.
- Commit completed changes and push with `git push origin HEAD:main`.
- If the first push fails, stop retrying and leave the commit ready for the user to push manually.
- Report the resulting version or documentation revision after every push.


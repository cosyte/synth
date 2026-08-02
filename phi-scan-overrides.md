# phi-scan bypass log

This file logs every `--allow-fixture <path>` bypass invocation of
`scripts/phi-scan.ts`. The scanner refuses to honor a `--allow-fixture <path>`
flag UNLESS this file contains a `### <path>` subsection referencing the same
path. The committed log is intentionally annoying — it discourages bypass and
creates an audit trail. Prefer extending `scripts/phi-allow-list.txt` (a
token-level, reviewed declaration) over a whole-file bypass, which silences
_every_ check for that file.

> **An override is the blunt instrument, and the argument-driven routes to a silent
> pass are closed.** A `--allow-fixture` path is purely _subtractive_: it can only
> remove a file the scan already enumerated, so it can never become the scan itself,
> and an entry here that matches no scanned file is an **error**, not a no-op — a
> stale bypass fails loudly instead of drifting. Both summary lines carry the number
> of files scanned, so an `OK` is never read without its denominator.
>
> Read that as "these routes are closed", not as "the gate cannot be collapsed".
> What the refusals constrain is the target _set_; they cannot see a file the
> enumerator never listed in the first place. The limits known at the time of
> writing are listed in the header of `scripts/phi-scan.ts`, and that list is not
> claimed to be complete.
>
> `pnpm phi-scan` is a **floor, not the whole gate**. The executable proof that
> nothing this package emits can be real or plausibly-real PHI is the property
> layer (`synthetic-safety.property.test.ts` and `test/phi/`). Read a green scan as
> "no real-looking PHI is committed", never as "the generator is synthetic-safe".

## Format

Each entry is a markdown subsection:

```
### <path>

- **Date:** <YYYY-MM-DD>
- **Reason:** <one-line justification>
- **Approved by:** <committer name>
- **Expires:** <YYYY-MM-DD or "permanent">
```

## Entries

(none yet)

# phi-scan bypass log

This file logs every `--allow-fixture <path>` bypass invocation of
`scripts/phi-scan.ts`. The scanner refuses to honor a `--allow-fixture <path>`
flag UNLESS this file contains a `### <path>` subsection referencing the same
path. The committed log is intentionally annoying: it discourages bypass and
creates an audit trail. Prefer extending `scripts/phi-allow-list.txt` (a
token-level, reviewed declaration) over a whole-file bypass, which silences
_every_ check for that file.

> **An override is the blunt instrument, and the argument-driven routes to a silent
> pass are closed.** A `--allow-fixture` path is purely _subtractive_: it can only
> remove a file the scan already enumerated, so it can never become the scan itself,
> and an entry here that matches no scanned file is an **error**, not a no-op, a
> stale bypass fails loudly instead of drifting. Both summary lines carry the number
> of files scanned, so an `OK` is never read without its denominator.
>
> Read that as "these routes are closed", not as "the gate cannot be collapsed".
> What the refusals constrain is the target _set_; they cannot see a file the
> enumerator never listed in the first place. The limits known at the time of
> writing are listed in the header of `scripts/phi-scan.ts`, and that list is not
> claimed to be complete.
>
> **All-mode reads more than the three scan roots.** It walks `src/`, `test/` and
> `scripts/`, and then reconciles what it walked against `git ls-files` and reads
> every tracked file the walk did not reach: the manifest, the lockfile, every
> workflow, every root config file. Before that, 49 of 225 tracked files were read
> by neither route. What is still read by neither is markdown (documentation quotes
> violator values, which is what this log does) and the vendored archives, named one
> literal path at a time in the scanner. **`--staged` still narrows to the three
> roots**, deliberately: the widening needs a corpus exemption, and an exemption on
> the commit-blocking route is the shape that has subtracted a real detection
> elsewhere. So a repo-root file is caught by CI rather than by the pre-commit hook.
>
> **What is unchanged on `--staged` is the ENUMERATION, and only that.** The
> allow-list is global and route-blind: it is read once and consumed where every mode
> shares it, so any entry in `scripts/phi-allow-list.txt` clears its value on the
> pre-commit route too. That is why an entry there is a reviewed act and why this log
> exists beside it.
>
> **One read failure is tolerated, and it is bounded on purpose.** All-mode lists
> `src/`, `test/` and `scripts/` and then reads each file, so a file created and
> deleted inside that window used to refuse the whole sweep. It is now reported on
> stderr as skipped instead, but only when the walk enumerated it itself, git does
> not track it, and the failure is `ENOENT`. A tracked file, any other failure, a
> file that is back on disk when the sweep ends, and a `git` that cannot say what is
> tracked all still refuse, and all-mode refuses outright if it observed no files at
> all. The denominator counts files actually read, so a skip shrinks it, though it
> shrinks against a total nobody saw, so **the stderr line is the signal, not the
> number**.
>
> **The residual, recorded rather than closed:** the post-sweep re-check is keyed on
> the path the walk enumerated, not on content, so an untracked file _renamed_ inside
> the window goes unread under a clean report. It is bounded: committing it means
> `git add`, after which it is tracked and untolerable, and the pre-commit gate reads
> the index either way. Closing it in general needs a content-addressed sweep;
> re-enumerating the scan roots afterwards would close the in-roots half more cheaply
> at the cost of a second walk and a new way to refuse. Both are a design trade for a
> later slice: neither is a wider bound, and neither is impossible.
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

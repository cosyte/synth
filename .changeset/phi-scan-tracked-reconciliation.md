---
"@cosyte/synth": patch
---

PHI scan: all-mode now reads every tracked file, not only the three scan roots, and a scan root of the wrong kind refuses instead of exiting 0 or 1.

On the base of this change, `pnpm phi-scan` read 176 of 225 tracked files: everything outside `src/`, `test/` and `scripts/` was opened by neither route, so `package.json`, `pnpm-lock.yaml`, every workflow and every root config file were scanned by nothing, and a repo-root file carrying a name, an SSN and an email exited 0 on both routes. All-mode now reconciles what it walked against `git ls-files` and reads every tracked file the walk did not reach: 198 of 225, with only markdown and the vendored archives left out, the archives named one literal path at a time.

The widening is a union with the walk and never a replacement of it, and the pre-commit route enumerates exactly what it always did: it still narrows to the three roots, deliberately, because the widening needs a corpus exemption and an exemption on the commit-blocking route is exactly what has subtracted a real detection elsewhere. One thing does change on every route, and it is stated rather than glossed: the publisher contact address in `package.json`, which the previous scope had never opened, is now declared in the allow-list, and an allow-list entry clears its value wherever it appears. That is one literal address, an organization's published contact rather than a person's, and the suite now pins both that it is cleared and that any other address at the same domain still fails.

Two walk-root defects close with it, both measured on this package rather than assumed from a sibling. A scan root that is a regular file threw `ENOTDIR` past the scanner's catch and exited 1, the code the contract reserves for "hits found"; a root symlinked at another root reported `OK, no hits` and exited 0 with the whole test corpus absent from disk. Both now refuse with 2, through an `lstat` on each root before the walk, because `existsSync` follows a link. The reconciliation also closes two states the per-root observation rule could not see: an absent directory inside a root, and a root emptied down to a single file, both of which used to report a clean sweep under a plausible denominator.

The one finding from reading the newly-opened files by hand was that publisher contact address, declared as an exact address rather than removed: it is the only email in any of them and there is no SSN shape in any of them.

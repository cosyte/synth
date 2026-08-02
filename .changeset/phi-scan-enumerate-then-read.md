---
"@cosyte/synth": patch
---

A file that appears and disappears while the PHI gate is running no longer makes it refuse the whole
scan. A full scan lists every file under the directories it covers and reads them one by one, so
anything created and deleted between those two steps was read after it was gone and the scan stopped
with an error instead of a verdict.

That was reachable here rather than theoretical. The gate's own test suite writes short-lived files
into two of the three directories the gate scans, and sweeping the working tree while that suite ran
stopped 8 of 165 sweeps.

**The refusal was right and the file list was wrong, so the list is what changed.** Refusing a scan
it could not finish is the property that makes this gate worth having, and it is untouched. Exactly
one case is now tolerated — a file the scan listed itself, that is not committed, and that is missing
when the scan reaches it. It is reported as skipped, never dropped in silence, and the "files
scanned" figure counts what was actually read, so a skip lowers it rather than padding it.

Everything below still stops the scan. Each is pinned by a test that reds when the bound is widened,
except the one marked otherwise:

- A committed file that cannot be read. The committed corpus is what the gate promises to have
  looked at, so failing to read one means the scan is incomplete.
- A read that fails for any other reason. Unreadable is not the same as absent, and a permissions
  error is a scan that failed rather than a file that went away.
- A repository that cannot say what it tracks. Without that answer there is no way to tell a
  short-lived file from committed content, so the tolerance switches off entirely.
- A tracked list that comes back empty, which would make every file look uncommitted and is the one
  state in which the previous bound quietly stops existing.
- A full scan that ends up having read nothing at all, so tolerating a missing file can never become
  a clean report of a tree nothing was read from.
- A skipped file that is back on disk when the scan finishes, because the scan then passed over
  something that exists. **This is the one bound with no test**, and deliberately so.

Pinning that last one needs a timing-dependent test, which is the failure this defect teaches. Losing
it would cost that re-check, not the tolerance's limits.

The tests reach that window with no sleep and no real build, and each runs against a throwaway
repository so no decoy file is ever written into this one. Pre-commit scans read committed content
directly and never depended on any of this.

One residual is disclosed rather than closed: the check that a skipped file has not returned matches
on the file's path, not its contents, so an uncommitted file renamed mid-scan goes unread under a
clean report. Committing it makes it tracked and no longer tolerable, and pre-commit reads committed
content either way. Closing it in general needs a content-addressed scan; re-listing the scanned
directories afterwards would close the in-directory half more cheaply, at the cost of a second walk
and a new way to refuse. Both are a design trade for a later change, not a wider bound.

Two smaller limits are recorded rather than closed, and both fail in the refusing direction. When
the repository cannot report what it tracks the scan still stops, but the message names the file it
could not read rather than that reason; and the tracked-file list is read through a 1 MiB buffer,
measured here at 6,556 bytes.

Provenance: `PHI-SCAN-ENUMERATE-THEN-READ-CLASS`, ported from the `ccda` remedy.

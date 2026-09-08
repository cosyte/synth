---
"@cosyte/synth": patch
---

The repository's PHI commit-gate (`pnpm phi-scan`) no longer honours a whole-file `--allow-fixture` bypass. A path the run enumerated and then did not open is now refused (exit 2) and named on stderr, because a scan that did not read a file has no clean verdict to give about it. The flag and its `phi-scan-overrides.md` log are both kept, so an attempt is still recorded and reviewable; what it can no longer do is produce a clean report.

This changes an observable exit code for an existing invocation shape: an argv carrying `--allow-fixture` that used to exit 0, or to exit with the hits code, now exits 2 in every mode, `--staged` included. Declaring a genuinely synthetic value in `scripts/phi-allow-list.txt` is the way to clear it, and unlike a whole-file bypass it leaves the file in the sweep. Nothing a consumer installs is affected: no generator, export, warning code or published artifact changes.

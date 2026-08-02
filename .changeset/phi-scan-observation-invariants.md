---
"@cosyte/synth": patch
---

The repository's PHI commit gate no longer reports `OK` over a scan it never performed, and it now sweeps the whole source tree rather than one directory.

No published API changes. This is the tooling that guards what gets committed here, and one honesty correction to the documented PHI posture.

- **The gate could be argued into scanning nothing and still exit 0.** `--allow-fixture <path>` used to seed the target set as well as subtract from it, so `--allow-fixture X` with no other argument meant "scan `[X]`, then subtract `X`" — an empty scan that printed the same `OK — no hits` a real pass prints. The flag is now purely subtractive: it can only remove a file the scan already enumerated, and it never decides what the scan covers.
- **Three invariants are checked before any hit counting.** An override that matches no scanned file is now an error rather than an inert entry that reads as a live bypass; a target set emptied by overrides is refused; and an all-mode enumeration that finds nothing is refused instead of passing. Both summary lines also carry the number of files scanned, so an `OK` is never read without the denominator it is an `OK` over.
- **The scan covers `src/`, `test/` and `scripts/`.** It previously stopped at `test/fixtures/`, which left every test outside that directory unswept even though this project builds messages as inline string literals in exactly those files. Measured on the widening: 114 in-scope files became 170. Over a `.ts` file the widening delivers the format-agnostic floor plus the content-gated arms (HL7 v2, X12, ASTM, NCPDP Telecom); the C-CDA, FHIR and NCPDP-SCRIPT arms remain gated on an `.xml`/`.json` extension, so they still do not reach an inline literal in a TypeScript test. That gating predates this change, is left alone deliberately, and is now recorded as a known gap rather than implied away.
- **The staged-file enumerator excludes git status letters instead of listing them.** It asked for `--diff-filter=AM`, an allow-list, so every status it did not name was skipped silently — a fixture renamed and edited in one commit (`R`), or one whose type changed from a symlink to a regular file (`T`), was never scanned. It now asks for everything except deletions, and disables rename detection so the destination path of a rename is the path that gets read.
- **`docs-content/limitations.md` claimed the project's own fixtures carry a `# synthetic: true` header.** None do; the header appears on two shipped value-pool sources. The sentence was removed rather than reworded, and the paragraph now says what is actually enforced.

Read a green scan as "no real-looking PHI is committed" — never as "the generator is synthetic-safe". That second claim belongs to the property suites, which are the executable proof, and this scanner is the commit-time floor beneath them.

---
"@cosyte/synth": patch
---

Documentation only, with one small observable string change.

The consumer-facing surfaces — `README.md`, the published docs pages, the npm `description` and
`keywords`, and the JSDoc that compiles into `dist/*.d.ts` and renders on hover in an editor — now
describe what the package does rather than how it came to be built. Internal identifiers, planning
sections, decision-record numbers and paths into a repository consumers cannot open have been removed.
A gate now checks those surfaces on every change; sentences that merely read as internal, with no
identifier in them, are still a reviewer's job and are not claimed to be exhaustively gone.

Several deferral notes that had gone stale were removed rather than reworded. The C-CDA and ASTM
subpath docs each said quirk generation was still to come while the same file exported the quirk API,
and the NCPDP subpath doc and the NCPDP guide said ASTM generation was not yet shipped when it is.

`DEID_LOOP_SKIPPED[].reason` changes for two of its three entries. The reasons still say the same
thing — `@cosyte/deid` ships no NCPDP SCRIPT locus map, and `@cosyte/synth` does not generate DICOM —
without the internal citation that followed each. Anything asserting those strings verbatim needs
updating; the `format` values and the shape of the constant are unchanged.

No other runtime behavior changes: the generators, the seeds and the bytes they produce are identical.

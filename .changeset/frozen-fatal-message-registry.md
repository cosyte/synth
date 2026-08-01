---
"@cosyte/synth": patch
---

Fatal messages now come from a frozen registry, and `SynthError` takes a code and no value at all.

Every selector the slot table enumerates is resolved against its own closed set before anything is generated, so those positions no longer reach an error message, a stack, or an identifier on a returned model.

Read the severity plainly, because overstating it would be its own kind of dishonesty. This is **not** a report that patient data leaked. `@cosyte/synth` generates synthetic fixtures, so the values that used to be quoted back were quirk names, document types, corpus mix entries and code-system URIs, and no real identifier has ever travelled through one. What changed is **why** the guarantee holds: it used to hold because of who happened to be calling, and it now holds because there is nowhere for a value to enter.

- `SynthError(code)` replaces `SynthError(code, message)`. Every message is a fixed entry in the new exported `SYNTH_FATAL_MESSAGES` table, keyed by code, and is identical for every occurrence of that code.
- Eight codes join the registry, covering the fatals that previously threw a bare `Error`, `TypeError` or `RangeError`, or threw nothing at all: `SYNTH_UNSUPPORTED_KIND`, `SYNTH_QUIRK_ANCHOR_ABSENT`, `SYNTH_INTENDED_WARNING_MISMATCH`, `SYNTH_UNMAPPED_CODE_SYSTEM`, `SYNTH_INVALID_DECIMAL`, `SYNTH_INVALID_RANGE`, `SYNTH_EMPTY_POOL` and `SYNTH_INVALID_PROFILE`. Every fatal raised by the generator entry points is branchable on `err.code`. The three `@cosyte/synth/deid` pairing loops are the stated exception: an unrecognised `variant`, `transaction` or `documentType` there still surfaces an uncoded `TypeError` (or, for `ccdaDeidLoop`, generates a Referral Note), and is tracked separately.
- **Every caller-supplied selector on the generator entry points is resolved rather than trusted**, through the new exported `resolveKind` and `resolveMix`: a message kind, an `ADT` trigger, a document type, a corpus mix entry, an `837` variant, a Bundle type, a `Patient` profile, a quirk kind. A selector union does not exist at run time, and an unrecognised one used to do three things at once. It travelled into an optional peer builder that is entitled to quote it back in its own error, so a caller-supplied string could reach a `message` and a `stack` through a `@cosyte/synth` entry point. It became an `Artifact.kind` and a `manifest.counts` key. And it fell out of an exhaustive `switch` as `undefined`, so `x12Corpus({ mix: ["270"] })` returned a corpus whose manifest said `270` and whose bytes were an `837` professional claim. All three are now a fatal `SYNTH_UNSUPPORTED_KIND`.
- `assertIntendedWarnings` loses its leading `quirk` parameter and is now `assertIntendedWarnings(intendedWarnings, bareWarnings)`. That parameter existed only to be interpolated into the refusal, so it was removed rather than left unused.
- `injectCcdaQuirk` fails closed on an unrecognised quirk name, where it previously returned `undefined` as though it were a document.
- `resolveQuirk` also refuses a descriptor it finds under a different format's registry, on the same code.
- `defineSynthProfile` rejects a blank `name` with a `SynthError` carrying `SYNTH_INVALID_PROFILE` where it used to raise a `TypeError`, and `Rng.int` and `Rng.pick` raise `SynthError` rather than `RangeError`.

Branch on `err.code`, not on message text — allowing for the `@cosyte/synth/deid` exception noted above. A fatal now names the rule that refused rather than the value that tripped it. That is a real loss of detail in a stack trace, and it is the trade being made deliberately: the caller still holds the value it passed, and the stack frame still names the call site.

The guarantee is bounded and the boundary is documented rather than implied: it covers what `@cosyte/synth` says about your call. It does not cover the artifact you asked it to build, a label you supply and get handed back, or a fatal an optional peer parser raises on a document you hand to a round-trip harness.

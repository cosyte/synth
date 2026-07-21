---
id: guides-quirks
title: Vendor-quirk generation
sidebar_position: 8
---

# Generate vendor-quirk fixtures

Spec-clean fixtures prove a parser reads a *correct* message. The harder, more valuable test is whether
a parser tolerates the **realistic vendor deviations** real-world traffic carries — and surfaces exactly
the right diagnostic when it does. That is what quirk mode generates.

The load-bearing idea: **the quirk vocabulary _is_ the parsers' own profile systems.** A `synth` quirk
deviates the *structure* of an otherwise spec-clean message so it round-trips through the parser to
**exactly one intended, stable warning code** — the tolerance the corresponding parser profile
(`hl7.defineProfile`, `ccda.defineCcdaProfile`, `astm.defineAstmProfile`) encodes. This is the
**intended-warning contract**: a quirk fixture is never a fiction — it exercises a documented, coded
leniency, and where a built-in **public** parser profile claims the deviation, the quirk round-trips
cleanly under it (suppressed, or re-badged to `PROFILE_QUIRK_APPLIED`).

Every quirk changes the message *shape*, never the *provenance* of the data — so a quirk fixture is still
**synthetic-by-construction** and passes the same synthetic-safety gate (roadmap §Phase 7).

Three formats ship quirks in this phase: **HL7 v2**, **C-CDA**, and **ASTM** — the parsers with the
richest profile systems. A quirk a format's profile system does not support fails closed with a stable
`SYNTH_UNSUPPORTED_QUIRK` diagnostic, never a silently-wrong fixture.

## HL7 v2 — a vendor Z-segment

A site-defined `Z`-segment is the canonical HL7 v2 quirk. A receiver with no profile flags it
`UNKNOWN_SEGMENT`; a `defineProfile` that declares the segment (here `@cosyte/hl7`'s public `visage`
imaging profile, which grounds `ZDS` in the Visage 7 interface spec) **suppresses** it:

```ts runnable
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";

const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 12345, quirk: "unknown-zsegment" }));
rt.warnings; // => ["UNKNOWN_SEGMENT"]
rt.intendedWarningHeld; // => true
rt.withProfile?.tolerated; // => true
```

## C-CDA — a deprecated LOINC code

C-CDA profiles **re-badge** a tolerated deviation to the value-free `PROFILE_QUIRK_APPLIED` marker. A
deprecated result LOINC round-trips to `DEPRECATED_LOINC`, and `@cosyte/ccda`'s public `smartScorecard`
profile (grounded in the SMART C-CDA Scorecard) re-badges it as expected:

```ts runnable
import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";

const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 12345, quirk: "deprecated-loinc" }));
rt.warnings; // => ["DEPRECATED_LOINC"]
rt.withProfile?.warnings; // => ["PROFILE_QUIRK_APPLIED"]
rt.withProfile?.tolerated; // => true
```

## ASTM — a non-standard escape

An ASTM `&Z&` escape body round-trips to `ASTM_UNKNOWN_ESCAPE_SEQUENCE`, and `@cosyte/astm`'s public
`referenceCorpus` profile (grounded in the redistributable kxepal/python-astm + senaite OSS corpus)
re-badges it:

```ts runnable
import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";

const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 12345, quirk: "unknown-escape" }));
rt.warnings; // => ["ASTM_UNKNOWN_ESCAPE_SEQUENCE"]
rt.withProfile?.tolerated; // => true
```

## Unsupported quirks fail closed

A quirk the format's profile system does not support is a fatal `SYNTH_UNSUPPORTED_QUIRK` — never a
silent no-op and never a fabricated quirk with a made-up warning:

```ts runnable
import { generateHl7Quirk } from "@cosyte/synth/hl7";

let code = "";
try {
  generateHl7Quirk({ seed: 1, quirk: "no-such-quirk" as never });
} catch (err) {
  code = (err as { code?: string }).code ?? "";
}
code; // => "SYNTH_UNSUPPORTED_QUIRK"
```

## A reproducible quirk corpus

Each format ships a quirk corpus that cycles every built-in quirk, seed-tagged and self-describing — its
manifest lists the applied quirks:

```ts runnable
import { ccdaQuirkCorpus } from "@cosyte/synth/ccda";

const corpus = ccdaQuirkCorpus({ seed: 42 });
[...corpus.manifest.quirks].sort(); // => ["deprecated-code-system", "deprecated-loinc", "template-extension-absent"]
```

## Grounding: public-only, never a private corpus

Every shipped quirk is grounded in a **publicly-documented** deviation or a parser's **public** profile
(ADR 0018) — a published IG, a vendor interface spec, or a redistributable OSS corpus. A quirk that would
need a **private, vendor-attributed corpus** to ground is **not shipped** — it stays deferred, exactly as
the parsers' named per-vendor profiles are `REAL-CORPUS`-gated. Quirk recipes for FHIR, X12, and NCPDP are
a later phase.

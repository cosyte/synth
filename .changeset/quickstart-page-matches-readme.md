---
"@cosyte/synth": patch
---

The Quickstart page now opens with the same program as the README: an HL7 v2 message generated from a seed and round-tripped through `@cosyte/hl7`, plus a mixed corpus.

Before this, the page opened with the seeded value providers while the README opened with the HL7 v2 generators, so a reader arriving from npm and one arriving from the documentation site met two different first programs. The value-provider, round-trip, corpus and determinism examples follow it. The test suite now fails if the page's first program differs from the README's quickstart, and runs it against the built package. Documentation and test change only.

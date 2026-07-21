---
"@cosyte/synth": patch
---

Phase 6 (SYNTH-8): spec-clean ASTM generation at the `@cosyte/synth/astm` subpath, built **through
`@cosyte/astm`'s own emit surface** — spec-clean by construction, round-tripping through the parser
with zero warnings, byte-stable, seed-deterministic, and synthetic by construction. This completes the
spec-clean generation core across all six formats (ASTM was gated on `@cosyte/astm`'s serializer,
`ASTM-7`, now shipped).

- New record generators (E1394): `generateAstmResult` (a full `H`/`P`/`O`/`R`…/`C`/`L` result report)
  and `generateAstmOrder` (`H`/`P`/`O`/`L`) via `buildAstmMessage`. New framing generator (E1381):
  `generateAstmResultFramed` via `composeAstmFrames` — the modulo-256 checksum and `0`–`7` frame
  numbers are computed by `@cosyte/astm`, never faked. Plus `astmCorpus`, the `astmRoundTrip` /
  `astmFramedRoundTrip` harnesses, the `astmPatient` / `astmOrder` / `astmHeaderIdentity` identity
  minters, and a license-clean `EXAMPLE_ASTM_TESTS` pool (public LOINC codes + invented local codes; no
  terminology prose bundled).
- Synthetic-safety at ASTM's PHI-dense `P` (patient) record: the patient name comes from the shipped
  fake-name pool, the birthdate is seeded, and the practice-assigned and laboratory-assigned patient
  IDs are minted **independently** under the synthetic assigning authority (`PRA` / `LAB`-prefixed) so
  they stay **distinct**. The repo `phi-scan` gains an ASTM arm (P-record name field 6 + practice/lab
  ID fields 3/4, tolerating an E1381 frame prefix so a framed fixture is swept identically).
- `@cosyte/astm` vendored as an optional peer dep (`vendor/cosyte-astm-0.0.0.tgz`), lazily loaded per
  format; third-party runtime deps stay at zero.
- Deferred: vendor-quirk mode (lowercase ASTM checksums, framing dropped over TCP, and the other
  tolerances `@cosyte/astm`'s profile system advertises) remains Phase 7.

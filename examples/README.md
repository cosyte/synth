# Examples

Four small programs that show what `@cosyte/synth` does, each runnable as it stands. Every example
imports `@cosyte/synth` by its published name, which resolves through this package's own `exports`
to the built `dist/`, so build first. Each one checks its own output and exits non-zero on a
mismatch.

```bash
pnpm install
pnpm build
pnpm examples                                  # runs all four
pnpm tsx examples/generate-an-hl7-message.ts   # or one at a time
```

| Example                                                      | What it shows                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`generate-an-hl7-message.ts`](./generate-an-hl7-message.ts) | An ADT^A01 from a seed: spec-clean on re-parse, byte-identical for the same seed, and every identifier from a reserved range (synthetic assigning authority, `555-01xx` phone, never-issued SSN). |
| [`generate-every-format.ts`](./generate-every-format.ts)     | One artifact each for FHIR US Core (a Patient and a transaction Bundle), C-CDA, X12 837P, NCPDP SCRIPT and Telecom, and ASTM, each round-tripped through its own parser with zero warnings.       |
| [`vendor-quirk.ts`](./vendor-quirk.ts)                       | Off-spec fixtures for HL7 v2, C-CDA and ASTM, each producing exactly the one warning it was built to cause, and tolerated by the public parser profile that claims the deviation.                 |
| [`deid-pairing-loop.ts`](./deid-pairing-loop.ts)             | The co-validation loop with `@cosyte/deid`: planted synthetic sentinels all removed, no clinical value over-scrubbed, and the formats with no de-identification adapter skipped and named.        |

Nothing here is real patient data, by construction: every value comes from a reserved range or the
shipped fake-name pool. The pairing loop is a co-validation of the two packages on this package's
own output, not an independent audit of `@cosyte/deid`.

The format parsers and `@cosyte/deid` are optional peer dependencies of the package and development
dependencies here. In your project, install only the ones whose fixtures you generate.

`tsconfig.json` in this folder maps `@cosyte/synth` to the source, so `pnpm typecheck` and
`pnpm lint` check the examples before anything is built. At run time nothing maps the name: Node
resolves it through `exports`, as it does in your project.

Split out of `CLAUDE.md` to keep that file inside its byte budget. The text below is unchanged.
A pointer written `notes#<section>` names a section of `agent-notes.md` beside this file.

## Engineering Guardrails

- No `any`. No unjustified `as` casts. Use `unknown` and narrow.
- JSDoc (with `@example`) on every public export: the JSDoc lint rule is an **error** on public
  exports, so this is enforced, not optional.
- Immutable by default. Mutation only via explicit methods.
- No `console.*` in library code. Throw typed errors or return results.
- Short, testable functions over big parsing blobs.
- Postel's Law: parser is liberal (lenient default + warnings), serializer is conservative (always
  emits spec-clean output).
- Fatal errors only for unrecoverable structural corruption (Tier-3 codes). Everything else is a
  warning with a stable code + positional context.
- **No diagnostic takes a value parameter.** `SynthError(code)` is the only error `src/` constructs
  and its message is a fixed entry in the frozen `SYNTH_FATAL_MESSAGES` table, so a caller string has
  no position through which to reach `message`, `stack` or a thrown field. **Adding a fatal means
  adding a registry entry, never a template string.** `notes#no-diagnostic-takes-a-value-parameter`.
- **Resolve every caller-supplied selector against its closed set** (`resolveKind`/`resolveMix`,
  `src/select.ts`) at the entry point, before anything is generated. **Not a style rule**: an
  unresolved selector reached an `err.message`/`err.stack` via a peer builder's `TypeError`, became an
  `Artifact.kind` and a `manifest.counts` key, and fell out of an exhaustive `switch` as `undefined`.
  All three were live. `notes#resolve-every-caller-supplied-selector-against-its-closed-set`.
- **Never claim `SynthError` being the only constructor is the whole guarantee**: `src/` can still
  surface a runtime `TypeError` or a peer parser's fatal on forwarded input. Harnesses keep
  `String(w.code)`, never a `message` or snippet; `test/phi/diagnostic-surface.test.ts` carries the
  proof. `notes#syntherror-being-the-only-constructor-is-not-the-whole-guarantee`.
- **Read the meta-repo's `documentation/repos/phi-audit.md` before touching that.** **A new safety
  sentence is worth nothing without a slot in that table behind it.**
  `notes#the-phi-free-diagnostics-claim`.
- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER
  (`node scripts/attw.mjs --profile node16`), NOT THE BARE CLI.** For a package that ships types that
  sentence means the declarations were **not in the tarball** (a broken publish reported as a pass),
  and no `--profile`, `--ignore-rules` or config setting reaches that early return. **The race only
  supplies the condition**, so the answer is not a lock, a lease or a build queue: the gate must be
  able to say its own inputs were missing, whatever removed them. `notes#the-attw-false-green-and-why-the-script-is-a-wrapper`.
- **Do NOT re-derive the exit-0 condition from the shape of the code: three refuter passes corrected
  it, each in the same direction, and "attw misses subpaths" is the plausible, wrong story.** The
  residual is a **known limit, filed rather than fixed; weaken the sentence rather than adding a
  fifth arm.** All three corrections, each with its measurement, and why a correct red explained by a
  falsehood is worse than it looks: `notes#the-false-green-needs-every-entry-point-untyped-at-once`,
  `notes#the-first-correction-was-also-wrong-in-the-same-direction`,
  `notes#missing-is-a-proxy-not-the-key-a-known-limit`.
- **`scripts/attw.mjs` carries TWO nets that catch different things** (a preflight over the relative
  paths `package.json` promises, and a post-check on the untyped sentence), both pinned by
  `test/scripts/attw-gate.test.ts` against the real binary plus a negative control.
  `notes#the-two-nets-in-scriptsattwmjs`.
- **The post-check reads a string, so the argument guard is an ALLOW-LIST, NOT A DENY-LIST**:
  `--profile` and `--no-definitely-typed` forwarded, everything else refused, "harmless" included.
  **Do not answer a hole in it with a seventh spelling.** The six measured routes, why a deny-list
  could not hold, and why the `.attw.json` refusal stays separate:
  `notes#the-argument-guard-is-an-allow-list-not-a-deny-list`.
- **The seven `file:vendor/*.tgz` devDeps are NOT part of the `attw` story**, `npm pack` emits no
  `vendor/` and attw does not resolve bare external specifiers. A **stale** vendored tarball makes
  this gate neither red nor green; a **missing** one is a different thing this sentence does not
  cover. `notes#the-vendored-tarballs-are-not-part-of-the-attw-story`.
- Coverage: per-directory >= 90% (lines/branches/functions/statements), enforced by
  `pnpm test:coverage`.

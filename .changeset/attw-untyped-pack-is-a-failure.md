---
"@cosyte/synth": patch
---

The `attw` publish gate no longer passes on a build that shipped no type declarations.

`attw` prints "This package does not contain types." and **exits 0**. That is not a bug in `attw` —
an untyped package is a legitimate npm package, so the CLI treats "no types at all" as a description
rather than a problem, and `getExitCode()` returns before the problem list is ever read. No
`--profile`, `--ignore-rules` or config setting reaches that early return. For a package that does
ship types it means the declarations were not in the tarball, which is a broken publish reported as a
pass. A false red costs an hour; a false green merges.

Measured here, on this package, with this repo's own arguments and no concurrency of any kind:
`rm -rf dist && pnpm attw` and `find dist -name '*.d.*ts' -delete && pnpm attw` both printed the
sentence and exited 0.

**The trigger is the build, not a race.** `tsup` emits JavaScript in one pass and the declaration
files in a later pass, so every build here has a window where `dist/` holds `.mjs`/`.cjs` and no
`.d.ts`. Measured across three consecutive clean builds at 6.4 s, 8.6 s and 7.4 s, against a whole
build of roughly 11 s — wide because this package emits declarations for eight entry points. A
concurrent build or a `clean` in the same working tree lands the gate inside it. So this is not
answered with a lock or a build queue: the gate is meant to be able to report that its own inputs
were missing, whatever removed them.

**The scope is narrower than it first looks, and the wider version of this claim is wrong.** With the
root entry's declarations intact and one subpath's missing, `attw` reports `UntypedResolution` and
exits 1 of its own accord, because the analysis then does find types and the early return is not
taken. A partial loss is `attw`'s own catch. What silences it is every entry point being untyped at
once — which is exactly what `rm -rf dist`, `clean`, and the build window above all produce.

**The preflight's own message says which of those it is looking at**, rather than always asserting
the strongest one. It claims the exit-0 counterfactual only when every declared declaration file is
*missing*; when some survive it says `attw` would have reported an untyped resolution and exited 1,
and that what the preflight adds there is the name of the artifact to rebuild. When a declaration is
present but *zero-byte* it claims no exit code at all, because such a file still resolves and so
types the package while declaring nothing.

That condition was got wrong twice, both times in the direction of overclaiming exit 0 — first keyed
on *any* missing declaration, then on every declared declaration being broken, which counts an empty
one as gone. A gate that reds correctly and then explains itself with a falsehood teaches the wider,
wrong story about the defect.

The `attw` script now runs through a wrapper with two nets, which catch different things:

- A **preflight**: every relative path `package.json` promises — `main`, `module`, `types`,
  `typings`, and every string leaf of `exports`, across all eight published subpaths — must exist and
  be non-empty before `attw` runs. This is the one that catches the build window, and it names the
  missing artifact, where `attw`'s own message says only that some resolution was untyped.
- A **post-check**: if `attw` still reports an untyped package, that is a failure. The preflight
  cannot see this case, because the declarations can be present on disk and still be left out of the
  tarball by `files` or `.npmignore`. No instance of that has occurred here; it is the case
  `attw --pack` exists to catch, and the point is that it catches it silently.

The post-check reads `attw`'s printed output, so the arguments it forwards are an **allow-list**:
`--profile` and `--no-definitely-typed`, and nothing else. Six routes were measured against the
pinned binary, each making the sentence unreadable while `attw` still exited 0: `--quiet`, `-q`,
`--format json`, `-f json`, `--format=json`, and a `.attw.json` setting `quiet` or `format`.

The allow-list is deliberate rather than a list of those spellings. A deny-list was tried first and
did not hold: it compared `arg.split("=")[0]`, which is token equality rather than option-name
matching, and a value fused to a short flag — `-fjson` — is neither `-f` nor `--format`, so it passed
straight through and restored the exact false green. Enumerating spellings buys one more per round.
Everything outside the allow-list is refused, including options that would blind nothing, because
"harmless" is not a judgement this gate can make from an option name; widening the set is a
deliberate one-line edit. The `.attw.json` refusal is kept separately, because `readConfig()` applies
it after argv and no argument guard of any shape can reach it.

`--profile node16` is unchanged and still applied; it is forwarded through the wrapper rather than
baked into it, and that forwarding is pinned by a test that observes the difference in `attw`'s own
output.

No published code changes: no runtime code, no types, and not one generated byte under `dist/`. The
tarball is not byte-identical: `CHANGELOG.md` is in `files` and this change adds an entry to it, and
`package.json` always ships and now carries a different `attw` script. Nothing a consumer imports or
executes moves. This is a change to what the release gate will let through.

The tests pin the upstream behaviour as well as the fix, so an `attw` upgrade that rewords the
sentence or fixes the exit code reds the suite rather than letting the net go quietly slack. They
also pin a negative control on a well-formed package and that a real `attw` failure still fails — a
gate that only ever fails is not a gate, and one that swallows the underlying status is not one
either.

Provenance: `ATTW-FALSE-GREEN-PORT`, ported from the `terminology` remedy, with its claims
re-measured against this package rather than carried over.

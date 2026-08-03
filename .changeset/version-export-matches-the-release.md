---
"@cosyte/synth": patch
---

The exported `VERSION` constant now reports the release you actually installed.

It did not. Every version of this package that has ever been published exports `VERSION === "0.0.0"`,
including the one on `latest` today. Measured on 2026-08-03 by unpacking each released tarball from
the registry rather than by reading the source tree:

```
for v in 0.0.1 0.0.2 0.0.3 0.0.4 0.0.5; do npm pack @cosyte/synth@$v; done
# every one: dist/index.cjs -> var VERSION = "0.0.0"
```

The cause is structural rather than a typo. Changesets owns the version bump and rewrites
`package.json` alone, so a constant written by hand in `src/index.ts` was never part of the release
and went stale at the first publish. Correcting the literal by hand would go stale again at the next
one, which is how it survived five releases.

So the bump and the constant are now bound together. `scripts/sync-version.mjs` rewrites the
declaration from the manifest, and it runs from the `version` script, in between `changeset version`
and the formatter, so both land in the same release commit. It is idempotent, and it **refuses**
rather than silently no-opping if the declaration has been renamed or reformatted, or if there is
more than one of it: a silent no-op is the exact failure being closed, so the release stops instead.

The guard is an equality assertion in `test/sanity.test.ts`, comparing the export against
`package.json` at test time rather than against a literal. This is the assertion that was missing:
the two checks already there assert that `VERSION` is a non-empty string and that it looks like
semver, and `"0.0.0"` satisfies both, so they stayed green through all five publishes. A second test
file covers the sync script itself, because it runs only during a release and would otherwise be
exercised for the first time at the moment it matters.

`VERSION` is now declared as `string` rather than left to infer its literal type. That is a small
change to the emitted declarations: consumers previously saw the literal type `"0.0.0"` in every
release, and once the value started tracking the manifest that type would have re-narrowed on each
bump. Reading and printing the value is unaffected. This matches the sibling packages.

Two documentation pages claimed this package was "not yet published to npm", which stopped being
true at the first publish and reaches readers through the shipped docs bundle. Both now say what
`README.md` already said: that it is published, on the pre-alpha `0.0.x` ladder, without repeating
the number, since a version written into prose is stale by construction on the next release. The
installation page's smoke test imports `VERSION`, so it is also now explicit that the constant names
the installed release, and that the check asserts the value's type rather than the value on purpose.

Provenance: `SYNTH-VERSION-CONSTANT-DRIFT`. The third instance of this defect class in the suite,
after `astm@0.0.1` and `terminology@0.0.1`; the mechanism adopted here is the one those two landed.

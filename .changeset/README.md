# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). Changesets drives
the **version bump**, the **publish**, and the **release section in `CHANGELOG.md`** for
`@cosyte/synth`: a release writes its own version heading there from the changesets it consumed. So
**the changeset summary is the changelog entry**. Write it there and do not hand-edit
`CHANGELOG.md`, whose sections above `## Released before this file was generated` are generated
output.

Add a changeset for every meaningful change:

```bash
pnpm changeset
```

Every changeset is a **patch**, on the `0.1.x` ladder: a fix, a new export, option, stable code or
published artifact, documentation of a surface that already ships, and contributor-only tooling
alike. It takes `0.1.0` to `0.1.1`. A breaking change before `1.0.0` is a patch too, and the
summary spells out the break and what a caller changes, because the number alone tells a consumer
nothing. A **minor** or a **major** is the maintainers' decision for a planned release, never a
contributor's pick for one change.

One rule is enforced rather than chosen: a change to the bytes a seed maps to has to be stated.
`pnpm run check:determinism-window` accepts a **major** changeset, or (the operator's decision D57,
2026-11-07) a changeset of any bump whose body carries an `Output change:` section, one paragraph,
naming every format that moved (`C-CDA`, `HL7 v2`, `FHIR`, `X12`, `NCPDP`, `ASTM`) and saying what
changed. It refuses a changed mapping stated only in prose.

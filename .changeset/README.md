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

Pick the bump type from what the change does to the published package. On the `0.1.x` ladder:

- **minor** for anything a consumer gains: a newly exported symbol, a new option, a new stable
  code, or a new published artifact they can use. It takes `0.1.x` to `0.2.0`.
- **patch** for a fix, for documentation of a surface that already ships, and for contributor-only
  tooling. It takes `0.1.0` to `0.1.1`.
- **major** only when you mean to declare `1.0.0`. Before that, a breaking change is a **minor**,
  and the break has to be spelled out in the summary, because the number alone tells a consumer on
  a `0.x` release nothing.

One rule is enforced rather than chosen: a change to the bytes a seed maps to has to be stated.
`pnpm run check:determinism-window` accepts a **major** changeset, or (the operator's decision D57,
2026-11-07) a changeset of any bump whose body carries an `Output change:` section, one paragraph,
naming every format that moved (`C-CDA`, `HL7 v2`, `FHIR`, `X12`, `NCPDP`, `ASTM`) and saying what
changed. It refuses a changed mapping stated only in prose.

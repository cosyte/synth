---
"@cosyte/synth": patch
---

`engines.node` is now `>=22.12.0`, where it was `>=22.0.0`. Since 0.1.6 a generator loads its parser on first use through `require`, and Node.js loads an ES module that way by default only from 22.12. On 22.0 to 22.11 the ES module build fell back to the parser's CommonJS entry, so a value it returned was an instance of a second copy of the parser's classes and `instanceof` against a class imported with `import` was false. The 0.1.6 entry said a returned value was an instance of the classes your code imports; that holds on 22.12 and later, and CI now runs the built package's smoke, which checks `instanceof` under `import` and `require`, on Node.js 22.12.0 itself. If you run Node.js 22.0 to 22.11, upgrade to 22.12 or later. npm warns about the engines range by default and refuses the install only with `engine-strict`.

If you bundle code that uses `@cosyte/synth`, mark `@cosyte/synth` and each `@cosyte/*` parser you use as external (esbuild `--external:@cosyte/*`, Rollup `external`, webpack `externals`) and install them beside the bundle. A bundler cannot follow the first-use load, so a bundle that inlines a parser holds a second copy of it, and one that omits a parser fails with "Cannot find module" on the first call that needs it.

No generated value, export, warning code or seed mapping changes.

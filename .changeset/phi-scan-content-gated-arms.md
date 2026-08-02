---
"@cosyte/synth": patch
---

The repository's PHI commit gate now decides what to inspect from a file's **contents** rather than its **name**. Three of its seven structured detectors previously ran only on a `.xml` or `.json` path, so the same bytes were refused in a fixture and passed in a TypeScript test that built the same document from a string literal. Those three now admit a target by its extension or by a marker in the bytes, and an extension is matched case-insensitively.

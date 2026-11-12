---
"@cosyte/synth": patch
---

Docs: no example prints a whole message or a value that identifies a person any more, and a new section, What is safe to log, lists the result fields never to log. No code changes.

The HL7 v2 generators' TSDoc examples, the README, the quickstart and the HL7 example program now print the message type, codes and booleans, and show an identifying value only in a comment marked synthetic. The README and the installation page say to pin the exact version, since below 1.0 a breaking change can ship in a patch. What is safe to log, on the fatal codes page, names `content`, `original`, `deidentified` and a sentinel's `token` as the fields that hold a whole artifact or a planted value. Nothing a caller does changes.

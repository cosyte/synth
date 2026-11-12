---
"@cosyte/synth": patch
---

HL7 v2 now generates ten more kinds, each built through `@cosyte/hl7`, read back with zero warnings, and fixed by its seed: `ACK`, `ADT^A02` (transfer), `ADT^A03` (discharge), `ADT^A11` (cancel admit), `ADT^A13` (cancel discharge), `ADT^A28` and `ADT^A31` (add and update person information), `MDM^T02` (a document and its text), `DFT^P03` (a posted charge) and `OML^O21` (a laboratory order). New exports from `@cosyte/synth/hl7`: `generateAck`, which answers any message (generated or your own) with an `AA`, `AE` or `AR` acknowledgment whose MSA-2 echoes its control id; `generateMdm`, `generateDft` and `generateOml`; and `HL7_MESSAGE_KINDS`, every kind `generateHl7` and `hl7Corpus` accept. `generateAdt` and the `triggers` option take the six new ADT triggers. The new kinds name their message structure in MSH-9.3. `generateAck` refuses an inbound message with no MSH-10 with the new fatal code `SYNTH_ACK_UNCORRELATED`.

Every message is still stamped HL7 v2.5: there is no option to stamp another version, because `@cosyte/hl7` has no per-version structure check to prove such a message valid. `RDE^O11` is not generated yet, because `@cosyte/hl7` publishes no structure for it.

Output for every existing kind is unchanged, byte for byte, and the default `hl7Corpus` mix is still the first seven kinds, so a seed's default corpus is unchanged: name the new kinds in `mix`, or pass `HL7_MESSAGE_KINDS`, to include them. What a caller changes: nothing, unless your code switches exhaustively over `Hl7MessageKind`, `AdtTrigger` or `SynthFatalCode`, each of which now has more members; add cases for them, or a default branch.

---
id: why-deid-checks-patient-fields
title: Why the removal check reads only the patient fields
sidebar_label: Why only the patient fields
description: "Why the deid pairing loop counts a survivor only at the fields that held patient identifiers, and what that lets a de-identifier keep."
---

# Why the removal check reads only the patient fields

The [pairing loop](./guides-deid.md) plants synthetic identifiers in an artifact, de-identifies it, and
checks that none is left. This page explains which fields that check reads, and why.

`synth` draws patient names, provider and organization names, addresses, and phone numbers from the
same synthetic pools, and a de-identifier may rightly keep a provider's identity. So the removal check
reads only the values left at the fields that held patient identifiers, not the whole document. A
provider name that the de-identifier keeps, and that happens to match a patient's, is not reported as
a survivor. The check reads the de-identifier's real serialized output, so a de-identifier that finds
a field and fails to clear it is still caught.

## Related

- [Check a de-identifier with the pairing loop](./guides-deid.md): the steps that run the loop.
- [What it does and does not do](./limitations.md#coverage-and-what-is-deferred): coverage across
  the formats.

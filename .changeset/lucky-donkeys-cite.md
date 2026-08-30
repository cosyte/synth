---
"@cosyte/synth": patch
---

The synthetic-safety floor table now cites, for every locus, the authority that reserves the range or defines the check digit, by that authority's own published identifier and with the sentence the row rests on, so you can open the text and check the claim instead of taking the page's word for it. Where a row was previously grounded on a bare hostname (`ssa.gov`, `nanpa.com`) or on nothing at all, it now names a document: SSA POMS RM 10201.035, IRS Internal Revenue Manual 3.21.263, 69 FR 3434 (FR Doc 04-1149), the NANPA 555 Line Numbers page, RFC 2606, RFC 6761, RFC 5737, RFC 3849, and USPS Postal Facts.

Two justifications were wrong and are corrected rather than restated. The NPI check-digit rule was attributed to a "CMS NPI check-digit rule, ISO 7812"; the rule that actually requires the `80840`-prefixed Luhn check is the Department of Health and Human Services final rule at 69 FR 3434, whose text names neither ISO 7812 nor CMS as its author, and the doc comments on `NPI_LUHN_PREFIX`, `npiCheckDigit` and `isSyntheticNpi` now cite it. The SSN row said SSA "never issues" the areas it draws from; what SSA's manual states is that those areas identify an **invalid** SSN, defined there as one SSA never assigned, so that is what the row and `isSyntheticSsn` now say.

Three limits that were implicit are now stated on the surface a consumer reads.

- **The DEA check digit is non-normatively sourced.** The formula `deaCheckDigit` implements is quoted from a pharmacy journal article (PMC3847977), not from the DEA, and no DEA-published statement of the algorithm is cited anywhere in this package. `isSyntheticDea` returning `true` means "fails that formula", not "the DEA could not have issued this", and both doc comments now say so, together with the consequence: if the formula is wrong, a value built to fail it could pass the real check.
- **Two loci have no reserving authority at all**, and their rows now say so and name what the floor rests on instead: the MRN / member / account namespace (the assigning authority, not the digits) and the name / street / city pool (the shipped clearly-fake pool itself).
- **The ZIP row draws an inference**, and now presents it as one. USPS publishes that the lowest ZIP Code is `00501`; that `00000` is therefore unassigned is this package's inference, not a Postal Service statement.

The claim that `2.16.840.1.113883.19` is a designated example root has been dropped from `SYNTHETIC_ASSIGNING_AUTHORITY`: no published designation could be shown, so none is claimed. The OID is unchanged and the guarantee never rested on it.

No generated value changes. Every reserved range, check-digit computation and predicate result is byte-for-byte what it was, so a pinned golden corpus is unaffected: this release changes what the package says about its floors, not where it draws from. A new suite fails the build if a floor-table locus is ever added without an authority identifier and the supporting text to go with it.

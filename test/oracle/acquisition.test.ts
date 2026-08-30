/**
 * The pre-grading integrity check: did we grade with the thing this repository pinned?
 *
 * Offline by construction. Nothing here downloads anything; the comparison is over strings, which is
 * exactly why it can be proven in an environment with no network and no JRE while the thing it
 * guards only ever happens in CI.
 *
 * The refusal is the subject. A gate that grades against an unverified binary and mentions it in a
 * footnote has already published a verdict somebody will quote.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { verifyAcquisition, type AcquisitionCheck } from "../../scripts/oracle/acquisition.js";
import { readOracleLock, versionFromResolvedUrl } from "../../scripts/oracle/lock.js";

const PINNED_DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);

const check = (overrides: Partial<AcquisitionCheck> = {}): AcquisitionCheck => ({
  name: "validator_cli.jar",
  source: "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/validator_cli.jar",
  expected: { version: "6.6.9", sha256: PINNED_DIGEST },
  observed: { version: "6.6.9", sha256: PINNED_DIGEST },
  ...overrides,
});

describe("an acquired artifact that does not match the recorded identity fails before grading", () => {
  it("a matching version and digest is accepted", () => {
    expect(verifyAcquisition([check()])).toEqual({ ok: true });
  });

  it("a digest mismatch is refused, and the refusal names both digests", () => {
    const verdict = verifyAcquisition([
      check({ observed: { version: "6.6.9", sha256: OTHER_DIGEST } }),
    ]);

    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals).toHaveLength(1);
    expect(verdict.refusals[0]).toContain("INTEGRITY MISMATCH");
    expect(verdict.refusals[0]).toContain(OTHER_DIGEST);
    expect(verdict.refusals[0]).toContain(PINNED_DIGEST);
  });

  it("a version mismatch is refused even when the digest matches", () => {
    const verdict = verifyAcquisition([
      check({ observed: { version: "6.6.10", sha256: PINNED_DIGEST } }),
    ]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals[0]).toContain("VERSION MISMATCH");
  });

  it("an UNRECORDED digest is refused rather than read as `accept anything`", () => {
    const verdict = verifyAcquisition([check({ expected: { version: "6.6.9", sha256: "" } })]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals[0]).toContain("no sha256 is recorded");
    // The refusal prints what arrived, so recording the pin is a deliberate act with the evidence
    // in front of the person doing it.
    expect(verdict.refusals[0]).toContain(PINNED_DIGEST);
  });

  it("a recorded value that is not a digest is refused rather than compared", () => {
    const verdict = verifyAcquisition([
      check({ expected: { version: "6.6.9", sha256: "latest" } }),
    ]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals[0]).toContain("not 64 hex characters");
  });

  it("an artifact whose bytes could not be hashed is refused, not assumed fine", () => {
    const verdict = verifyAcquisition([check({ observed: { version: "6.6.9", sha256: "" } })]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals[0]).toContain("no readable sha256");
  });

  it("digest comparison does not let letter case decide the answer", () => {
    const verdict = verifyAcquisition([
      check({ observed: { version: "6.6.9", sha256: PINNED_DIGEST.toUpperCase() } }),
    ]);
    expect(verdict).toEqual({ ok: true });
  });

  it("every mismatched artifact is reported, so one run says all of it", () => {
    const verdict = verifyAcquisition([
      check({ observed: { version: "6.6.9", sha256: OTHER_DIGEST } }),
      check({
        name: "hl7.fhir.us.core",
        expected: { version: "6.1.0", sha256: PINNED_DIGEST },
        observed: { version: "7.0.0", sha256: PINNED_DIGEST },
      }),
    ]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals).toHaveLength(2);
  });

  it("a check over NOTHING is refused, because a vacuous pass looks exactly like a real one", () => {
    const verdict = verifyAcquisition([]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusals[0]).toContain("no acquired artifact was checked");
  });
});

describe("an acquired artifact's version is derived from the URL the download resolved to", () => {
  it.each([
    [
      "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/validator_cli.jar",
      "6.6.9",
    ],
    ["https://packages.fhir.org/hl7.fhir.us.core/6.1.0", "6.1.0"],
    ["https://example.invalid/nothing/", "nothing"],
  ])("%s names version %s", (url, expected) => {
    expect(versionFromResolvedUrl(url)).toBe(expected);
  });

  it("a URL that names no version yields an empty string, which the check then refuses", () => {
    expect(versionFromResolvedUrl("not a url")).toBe("");
    const verdict = verifyAcquisition([
      check({ observed: { version: "", sha256: PINNED_DIGEST } }),
    ]);
    expect(verdict.ok).toBe(false);
  });
});

describe("the committed pin is readable and fully spelled out", () => {
  it("names both components, their sources and the FHIR version", () => {
    const lock = readOracleLock();
    expect(lock.fhirVersion).toBe("4.0.1");
    expect(lock.validator.downloadUrl).toMatch(/^https:\/\//);
    expect(lock.conformancePackage.name).toBe("hl7.fhir.us.core");
    expect(lock.conformancePackage.version).toBe("6.1.0");
  });

  it("declares the terminology setting explicitly, so the endpoint record can be exact", () => {
    const raw: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "scripts", "oracle", "oracle-lock.json"),
        "utf8",
      ),
    );
    expect(raw).toHaveProperty("terminologyServer");
  });
});

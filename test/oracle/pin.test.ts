/**
 * THE COMMITTED PIN HAS TO BE ABLE TO NAME WHAT IT PINS, and that is checkable without a network.
 *
 * The failure this closes is not hypothetical and it was not cheap. The validator entry pointed at
 * the address the validator's own README publishes, which serves whatever upstream released most
 * recently. A recorded version and a recorded digest cannot both agree with an address like that for
 * longer than upstream stays still, so every branch reddened at the identity check before a single
 * artifact was generated: the gate was reporting "nothing was graded" on trees where nothing was
 * wrong, which is the shape of failure that gets a gate switched off.
 *
 * So the invariant is asserted HERE, over the committed file, in the offline suite: every pinned
 * source names exactly one published release or one registry version, and that version is the one
 * recorded beside it. An edit that reintroduces a floating source, or a version bump that forgets
 * its address, reds in `pnpm test` in seconds rather than in CI weeks later.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO IS RESTATE THE DIGEST. The pin is the single place a source or
 * a digest is recorded; copying either into a test would make it two places, and the copy would be
 * the one nobody updates. The digest's job is to catch upstream replacing the bytes behind a fixed
 * address, which it can only do from the pin itself.
 */

import { describe, expect, it } from "vitest";

import {
  planAcquisition,
  readOracleLock,
  versionNamedBySource,
  type OracleLock,
  type PinnedComponent,
  type PinnedKey,
} from "../../scripts/oracle/lock.js";

const lock = readOracleLock();

/** Every artifact the pin pins, so a third one added later is covered with no edit here. */
const pinnedComponents: [PinnedKey, PinnedComponent][] = [
  ["validator", lock.validator],
  ["conformancePackage", lock.conformancePackage],
];

/** The committed pin with one component replaced, for the refusal cases. */
const lockWith = (key: PinnedKey, over: Partial<PinnedComponent>): OracleLock => ({
  ...lock,
  [key]: { ...lock[key], ...over },
});

describe("every pinned artifact is addressed by version", () => {
  it.each(pinnedComponents)("%s names exactly one version in its download source", (_key, c) => {
    expect(versionNamedBySource(c.downloadUrl)).not.toBe("");
  });

  it.each(pinnedComponents)("%s records the version its own source names", (_key, c) => {
    expect(versionNamedBySource(c.downloadUrl)).toBe(c.version);
  });

  it.each(pinnedComponents)("%s records a sha256, and one shaped like a digest", (_key, c) => {
    expect(c.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no pinned source resolves to whatever upstream published most recently", () => {
    for (const [, c] of pinnedComponents) {
      expect(c.downloadUrl).not.toMatch(/\/releases\/latest\//);
      expect(c.downloadUrl.toLowerCase().split("/").at(-1)).not.toBe("latest");
    }
  });

  it("the whole committed pin plans an acquisition rather than refusing one", () => {
    expect(planAcquisition(lock)).toEqual({
      ok: true,
      artifacts: pinnedComponents.map(([key, c]) => ({
        key,
        name: c.name,
        source: c.downloadUrl,
        version: c.version,
      })),
    });
  });
});

describe("a pin that cannot name what it pins is refused before anything is downloaded", () => {
  it("a floating source is refused, and the refusal names the artifact", () => {
    const plan = planAcquisition(
      lockWith("validator", {
        downloadUrl:
          "https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar",
      }),
    );

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0]).toContain(lock.validator.name);
    expect(plan.refusals[0]).toContain("names no single release or registry version");
  });

  it("a source naming a different version than the pin records is refused, naming both", () => {
    const plan = planAcquisition(
      lockWith("validator", {
        downloadUrl:
          "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/9.9.9/validator_cli.jar",
      }),
    );

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusals[0]).toContain("SOURCE AND VERSION DISAGREE");
    expect(plan.refusals[0]).toContain("9.9.9");
    expect(plan.refusals[0]).toContain(lock.validator.version);
  });

  it("the registry entry is held to the same rule, not only the release download", () => {
    const plan = planAcquisition(
      lockWith("conformancePackage", {
        downloadUrl: "https://packages.fhir.org/hl7.fhir.us.core/latest",
      }),
    );

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusals[0]).toContain(lock.conformancePackage.name);
  });

  it("every unidentifiable artifact is reported, so one run says all of it", () => {
    const broken: OracleLock = {
      ...lock,
      validator: { ...lock.validator, downloadUrl: "https://example.invalid/validator/latest" },
      conformancePackage: {
        ...lock.conformancePackage,
        downloadUrl: "https://packages.fhir.org/hl7.fhir.us.core/latest",
      },
    };

    const plan = planAcquisition(broken);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusals).toHaveLength(2);
  });
});

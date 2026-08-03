import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { VERSION } from "../src/index.js";

const pkg: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Narrow the parsed manifest without an `as` cast: the sanity test must not lie about its input. */
function manifestVersion(manifest: unknown): string {
  if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
    throw new Error("package.json did not parse to an object with a `version` field");
  }
  const { version } = manifest;
  if (typeof version !== "string") throw new Error("package.json `version` is not a string");
  return version;
}

describe("toolchain sanity", () => {
  it("resolves the public entry point and exports VERSION as a string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("package exports VERSION matching package.json", () => {
    // Compared against package.json, never a hardcoded literal. `changeset version` bumps
    // package.json alone, so a release that skipped `scripts/sync-version.mjs` (wired into the
    // `version` script) publishes a VERSION export that lies about the release. That is not
    // hypothetical: 0.0.1 through 0.0.5 all went to the registry exporting "0.0.0", and the
    // shape-only assertions above stayed green through every one of them.
    expect(VERSION).toBe(manifestVersion(pkg));
  });

  it("exposes VERSION as a semver-looking string", () => {
    // Shape only, so a bump needs no edit here: the value itself is pinned to package.json above.
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:[.-].+)?$/);
  });

  it("keeps the declaration in the exact shape scripts/sync-version.mjs rewrites", () => {
    // The assertion above compares two VALUES, so it cannot see the sync step being disarmed. Drop
    // the `: string` annotation (it reads as redundant, which is exactly why someone tidies it away)
    // and every value here still agrees: the script only stops matching at the next `changeset
    // version`, which is the one moment this mechanism exists to cover. It refuses rather than
    // no-opping, so the release fails loudly, but it fails on release day rather than in the pull
    // request that broke it. This moves that discovery forward to CI.
    //
    // The pattern MIRRORS the one in scripts/sync-version.mjs and the two must move together. It is
    // duplicated rather than imported because the script is an executable, not a module.
    const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const matches = source.match(/^export const VERSION: string = "[^"]*";$/gm);

    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);
    expect(matches?.[0]).toBe(`export const VERSION: string = "${VERSION}";`);
  });
});

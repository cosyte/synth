import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { highestOf, lowestOf, parseVersion, satisfies } from "../scripts/peer-range.js";

interface Manifest {
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const read = (path: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));

const pkg = read("../package.json") as Manifest;
const peers = Object.entries(pkg.peerDependencies);

/** The version of `name` the test suite runs against: what the install put in `node_modules`. */
function installed(name: string): string {
  return (read(`../node_modules/${name}/package.json`) as { version: string }).version;
}

describe("the range helper", () => {
  it("reads a caret range the way npm does below 1.0", () => {
    expect(satisfies("0.1.5", "^0.1.5")).toBe(true);
    expect(satisfies("0.1.9", "^0.1.5")).toBe(true);
    expect(satisfies("0.1.4", "^0.1.5")).toBe(false);
    expect(satisfies("0.2.0", "^0.1.5")).toBe(false);
    expect(satisfies("1.4.0", "^1.2.3")).toBe(true);
    expect(satisfies("2.0.0", "^1.2.3")).toBe(false);
    expect(satisfies("0.0.3", "^0.0.3")).toBe(true);
    expect(satisfies("0.0.4", "^0.0.3")).toBe(false);
  });

  it("takes either side of a union", () => {
    expect(satisfies("0.1.6", "^0.1.5 || ^0.2.0")).toBe(true);
    expect(satisfies("0.2.3", "^0.1.5 || ^0.2.0")).toBe(true);
    expect(satisfies("0.3.0", "^0.1.5 || ^0.2.0")).toBe(false);
  });

  it("never matches a prerelease or a malformed version", () => {
    expect(satisfies("0.2.0-next.1", "^0.1.5 || ^0.2.0")).toBe(false);
    expect(parseVersion("0.2")).toBeNull();
    expect(() => satisfies("0.2.0", ">=0.1.0")).toThrow(/unsupported range/);
  });

  it("names the lowest version a range admits", () => {
    expect(lowestOf("^0.1.5 || ^0.2.0")).toBe("0.1.5");
    expect(lowestOf("^0.2.0 || ^0.1.5")).toBe("0.1.5");
  });

  it("names the highest published version a range admits", () => {
    const published = ["0.1.4", "0.1.5", "0.2.0", "0.2.3", "0.2.4-next.0", "0.3.0"];
    expect(highestOf(published, "^0.1.5 || ^0.2.0")).toBe("0.2.3");
    expect(highestOf(published, "^0.1.5")).toBe("0.1.5");
    expect(highestOf(published, "^0.4.0")).toBeNull();
  });
});

describe("peer ranges", () => {
  it.each(peers)("%s admits the version the tests run against", (name, range) => {
    expect(pkg.devDependencies[name]).toBeDefined();
    expect(satisfies(installed(name), range)).toBe(true);
  });

  it("admits the 0.2 line of @cosyte/deid, so npm installs synth beside it", () => {
    const range = pkg.peerDependencies["@cosyte/deid"] ?? "";
    expect(satisfies("0.2.3", range)).toBe(true);
    expect(satisfies(installed("@cosyte/deid"), "^0.2.3")).toBe(true);
  });
});

/**
 * A parser that is not installed: what a caller sees.
 *
 * Each case loads a parser through the real Node.js resolver and the real `require`, from a
 * project directory written under the system's temporary directory, so the errors are the ones
 * Node.js itself raises, not copies of their text. In one project no parser is installed. In the
 * other `@cosyte/hl7` is installed but one of its own dependencies is not, which must not read as
 * the parser being missing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SYNTH_FATAL_CODES,
  SYNTH_FATAL_MESSAGES,
  SYNTH_PEER_MESSAGES,
  SynthError,
} from "../src/index.js";
import { loadPeer, type PeerHost } from "../src/peer.js";

/** A project directory: an ES module that resolves from it, and a `require` made in it. */
interface Project {
  readonly esm: PeerHost;
  readonly cjs: PeerHost;
}

const root = mkdtempSync(join(tmpdir(), "synth-peer-missing-"));

/** Write a project at `dir`, with the files given under it, and build its two hosts. */
async function project(dir: string, files: Readonly<Record<string, string>>): Promise<Project> {
  for (const [path, text] of Object.entries(files)) {
    const file = join(dir, ...path.split("/"));
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, text);
  }
  const resolverFile = join(dir, "resolver.mjs");
  writeFileSync(resolverFile, "export const resolve = (s) => import.meta.resolve(s);\n");
  const { resolve } = (await import(pathToFileURL(resolverFile).href)) as {
    resolve: (specifier: string) => string;
  };
  const require = createRequire(join(dir, "index.cjs"));
  return { esm: { require, resolve }, cjs: { require, resolve: undefined } };
}

let empty: Project;
let transitive: Project;

beforeAll(async () => {
  empty = await project(join(root, "empty"), { "package.json": "{}\n" });
  transitive = await project(join(root, "transitive"), {
    "package.json": "{}\n",
    "node_modules/@cosyte/hl7/package.json": JSON.stringify({
      name: "@cosyte/hl7",
      exports: { ".": { import: "./index.mjs", require: "./index.cjs" } },
    }),
    "node_modules/@cosyte/hl7/index.mjs": 'export * from "synth-test-absent-dependency";\n',
    "node_modules/@cosyte/hl7/index.cjs":
      'module.exports = require("synth-test-absent-dependency");\n',
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** What `load` threw. */
function thrown(load: () => unknown): unknown {
  try {
    load();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

describe("a parser that is not installed", () => {
  for (const build of ["esm", "cjs"] as const) {
    it(`throws SYNTH_PEER_NOT_INSTALLED naming it and its install command (${build} build)`, () => {
      const error = thrown(() => loadPeer("@cosyte/hl7", empty[build]));
      expect(error).toBeInstanceOf(SynthError);
      const synth = error as SynthError;
      expect(synth.code).toBe(SYNTH_FATAL_CODES.SYNTH_PEER_NOT_INSTALLED);
      expect(synth.peer).toBe("@cosyte/hl7");
      expect(synth.message).toBe(SYNTH_PEER_MESSAGES["@cosyte/hl7"]);
      expect(synth.message).toContain("@cosyte/hl7");
      expect(synth.message).toContain("npm install @cosyte/hl7");
      // The error Node.js raised is kept, with its own code.
      const cause = synth.cause as { code?: unknown };
      expect(cause).toBeInstanceOf(Error);
      expect(cause.code).toBe(build === "esm" ? "ERR_MODULE_NOT_FOUND" : "MODULE_NOT_FOUND");
    });

    it(`names the package, not the subpath, for a subpath peer (${build} build)`, () => {
      const error = thrown(() => loadPeer("@cosyte/deid/hl7", empty[build])) as SynthError;
      expect(error.code).toBe(SYNTH_FATAL_CODES.SYNTH_PEER_NOT_INSTALLED);
      expect(error.peer).toBe("@cosyte/deid");
      expect(error.message).toContain("npm install @cosyte/deid");
    });

    it(`passes on a missing dependency of an installed parser as it is (${build} build)`, () => {
      const error = thrown(() => loadPeer("@cosyte/hl7", transitive[build]));
      expect(error).not.toBeInstanceOf(SynthError);
      expect(String((error as Error).message)).toContain("synth-test-absent-dependency");
      expect((error as { code?: unknown }).code).toBe(
        build === "esm" ? "ERR_MODULE_NOT_FOUND" : "MODULE_NOT_FOUND",
      );
    });
  }

  it("passes on any other failure to load a parser as it is", () => {
    const failing = (error: unknown): PeerHost => ({
      require: () => {
        throw error;
      },
      resolve: undefined,
    });
    const others: readonly unknown[] = [
      null,
      { code: "MODULE_NOT_FOUND" },
      Object.assign(new Error("No exports main defined"), {
        code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
      }),
      // The right code, naming another module.
      Object.assign(new Error("Cannot find module '@cosyte/hl7-extra'"), {
        code: "MODULE_NOT_FOUND",
      }),
      Object.assign(new Error("Cannot find package '@cosyte/hl7x' imported from /a"), {
        code: "ERR_MODULE_NOT_FOUND",
      }),
    ];
    for (const error of others) {
      expect(
        thrown(() => loadPeer("@cosyte/hl7", failing(error))),
        String(error),
      ).toBe(error);
    }
  });

  it("names a parser only on the code that means it", () => {
    const other = new SynthError(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL, { peer: "@cosyte/hl7" });
    expect(other.message).toBe(SYNTH_FATAL_MESSAGES.SYNTH_EMPTY_POOL);
    expect(other.peer).toBeUndefined();
    const cause = new Error("x");
    expect(new SynthError(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL, { cause }).cause).toBe(cause);
  });

  it("passes on a missing package that is not one of the parsers", () => {
    for (const build of ["esm", "cjs"] as const) {
      const error = thrown(() => loadPeer("synth-test-absent-dependency", empty[build]));
      expect(error, build).not.toBeInstanceOf(SynthError);
    }
  });

  it("has one message for each parser, and a plain one for the code itself", () => {
    expect(Object.keys(SYNTH_PEER_MESSAGES).sort()).toEqual([
      "@cosyte/astm",
      "@cosyte/ccda",
      "@cosyte/deid",
      "@cosyte/fhir",
      "@cosyte/hl7",
      "@cosyte/ncpdp",
      "@cosyte/x12",
    ]);
    for (const [peer, message] of Object.entries(SYNTH_PEER_MESSAGES)) {
      expect(message).toBe(
        `${peer} is not installed, and this generator builds through it. Install it beside @cosyte/synth: npm install ${peer}`,
      );
    }
    const plain = new SynthError(SYNTH_FATAL_CODES.SYNTH_PEER_NOT_INSTALLED);
    expect(plain.message).toBe(SYNTH_FATAL_MESSAGES.SYNTH_PEER_NOT_INSTALLED);
    expect(plain.peer).toBeUndefined();
    expect(plain.cause).toBeUndefined();
    expect(Object.keys(plain)).not.toContain("peer");
    expect("cause" in plain).toBe(false);
    const named = new SynthError(SYNTH_FATAL_CODES.SYNTH_PEER_NOT_INSTALLED, {
      peer: "@cosyte/x12",
    });
    expect(Object.keys(named)).toContain("peer");
    expect(named.message).toBe(SYNTH_PEER_MESSAGES["@cosyte/x12"]);
  });
});

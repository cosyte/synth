/**
 * Importing a format's subpath loads no sibling parser: the parser loads on the first call that
 * needs it, once. Each parser is one large module, and loading it at import was most of a
 * subpath's cold import.
 *
 * The check records every `@cosyte/*` parser specifier Node.js resolves, through a resolve hook
 * registered in this thread, while a subpath is imported fresh and then while it generates.
 */

import module from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { lazyPeer, loadPeer, type PeerHost } from "../src/peer.js";

/**
 * Where a fake host says a peer's ES module entry is: an absolute path, with a drive letter on
 * Windows, since `fileURLToPath` refuses a `file:` URL without one there.
 */
const entryPath = (specifier: string): string => resolve("/peers", specifier, "index.mjs");

/** The same entry as the `file:` URL `import.meta.resolve` returns. */
const entryUrl = (specifier: string): string => pathToFileURL(entryPath(specifier)).href;

/** The parser packages resolved since the last reset, by specifier or by the file they resolve to. */
const resolved = new Set<string>();

const BY_NAME = /^(@cosyte\/(?:hl7|fhir|ccda|x12|ncpdp|astm|deid))(?:\/|$)/;
const BY_FILE = /\/node_modules\/(@cosyte\/(?:hl7|fhir|ccda|x12|ncpdp|astm|deid))\//;

type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    next: (specifier: string, context: unknown) => { url: string },
  ) => { url: string };
}) => { deregister: () => void };

const registerHooks = (module as unknown as { registerHooks?: RegisterHooks }).registerHooks;

const hooks = registerHooks?.({
  resolve(specifier, context, next) {
    const result = next(specifier, context);
    const name = BY_NAME.exec(specifier)?.[1] ?? BY_FILE.exec(result.url)?.[1];
    if (name !== undefined) resolved.add(name);
    return result;
  },
});

afterAll(() => hooks?.deregister());

beforeEach(() => {
  vi.resetModules();
  resolved.clear();
});

/** A fresh import of each subpath's source. */
const IMPORTS: Readonly<Record<string, () => Promise<unknown>>> = {
  hl7: () => import("../src/hl7/index.js"),
  fhir: () => import("../src/fhir/index.js"),
  ccda: () => import("../src/ccda/index.js"),
  x12: () => import("../src/x12/index.js"),
  ncpdp: () => import("../src/ncpdp/index.js"),
  astm: () => import("../src/astm/index.js"),
  deid: () => import("../src/deid/index.js"),
};

/** Each subpath, a call that generates through its parser, and the parser it must then load. */
const SUBPATHS: readonly [string, (mod: Record<string, unknown>) => unknown, string][] = [
  ["hl7", (m) => (m["hl7Corpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/hl7"],
  ["fhir", (m) => (m["fhirCorpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/fhir"],
  ["ccda", (m) => (m["ccdaCorpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/ccda"],
  ["x12", (m) => (m["x12Corpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/x12"],
  ["ncpdp", (m) => (m["ncpdpCorpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/ncpdp"],
  ["astm", (m) => (m["astmCorpus"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/astm"],
  ["deid", (m) => (m["hl7DeidLoop"] as (o: object) => unknown)({ seed: 1 }), "@cosyte/deid"],
];

describe.runIf(registerHooks !== undefined)("each subpath loads its parser on first use", () => {
  for (const [subpath, generate, parser] of SUBPATHS) {
    it(`importing ${subpath} loads no parser, and generating loads ${parser}`, async () => {
      const mod = (await IMPORTS[subpath]?.()) as Record<string, unknown>;
      expect([...resolved]).toEqual([]);
      generate(mod);
      expect([...resolved]).toContain(parser);
    });
  }
});

describe("loadPeer and lazyPeer", () => {
  it("loads the entry `import` resolves to, through require", () => {
    const required: string[] = [];
    const host: PeerHost = {
      require: (id) => {
        required.push(id);
        return { id };
      },
      resolve: entryUrl,
    };
    expect(loadPeer("@cosyte/x", host)).toEqual({ id: entryPath("@cosyte/x") });
    expect(required).toEqual([entryPath("@cosyte/x")]);
  });

  it("falls back to the CommonJS entry where Node.js cannot require an ES module", () => {
    const required: string[] = [];
    const host: PeerHost = {
      require: (id) => {
        required.push(id);
        if (id.endsWith(".mjs")) throw Object.assign(new Error("esm"), { code: "ERR_REQUIRE_ESM" });
        return { id };
      },
      resolve: entryUrl,
    };
    expect(loadPeer("@cosyte/x", host)).toEqual({ id: "@cosyte/x" });
    expect(required).toEqual([entryPath("@cosyte/x"), "@cosyte/x"]);
  });

  it("requires the specifier itself where the host cannot resolve it to a file", () => {
    // Deno's test runner throws from `import.meta.resolve`; a resolver may also answer with a URL
    // that is not a `file:` URL. Either way the specifier goes to `require` as it is.
    const required: string[] = [];
    const throwing: PeerHost = {
      require: (id) => {
        required.push(id);
        return { id };
      },
      resolve: () => {
        throw new TypeError("Invalid arguments");
      },
    };
    expect(loadPeer("@cosyte/x", throwing)).toEqual({ id: "@cosyte/x" });
    const notAFile: PeerHost = { ...throwing, resolve: (s) => `npm:/${s}@1.0.0/index.mjs` };
    expect(loadPeer("@cosyte/x", notAFile)).toEqual({ id: "@cosyte/x" });
    expect(required).toEqual(["@cosyte/x", "@cosyte/x"]);
  });

  it("passes on every other error from resolving, so no second copy of a parser loads", () => {
    // On Node.js a resolve can fail for a reason that `require` of the name would get past, such
    // as a package whose `exports` has no `import` entry. Falling back then would load the
    // CommonJS copy of a parser and break `instanceof`, so only Deno's own refusal falls back.
    const required: string[] = [];
    const failing = (error: unknown): PeerHost => ({
      require: (id) => {
        required.push(id);
        return { id };
      },
      resolve: () => {
        throw error;
      },
    });
    const others: readonly unknown[] = [
      Object.assign(new Error("Cannot find package"), { code: "ERR_MODULE_NOT_FOUND" }),
      Object.assign(new Error("No exports"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
      // The same message as Deno's, but with a Node.js code, or not a TypeError.
      Object.assign(new TypeError("Invalid arguments"), { code: "ERR_INVALID_ARG_TYPE" }),
      new Error("Invalid arguments"),
      new TypeError("Invalid URL"),
      null,
    ];
    for (const error of others) {
      expect(() => loadPeer("@cosyte/x", failing(error)), String(error)).toThrow();
    }
    expect(required).toEqual([]);
    expect(loadPeer("@cosyte/x", failing(new TypeError("Invalid arguments")))).toEqual({
      id: "@cosyte/x",
    });
    expect(required).toEqual(["@cosyte/x"]);
  });

  it("throws on a `file:` URL that names no path, rather than load a second copy", () => {
    // `fileURLToPath` refuses an encoded slash on every system. A resolver that answers with such
    // a URL is broken; requiring the specifier instead would load the CommonJS copy of the parser.
    const required: string[] = [];
    const host: PeerHost = {
      require: (id) => {
        required.push(id);
        return { id };
      },
      resolve: () => "file:///peers/a%2Fb/index.mjs",
    };
    expect(() => loadPeer("@cosyte/x", host)).toThrow(
      expect.objectContaining({ code: "ERR_INVALID_FILE_URL_PATH" }),
    );
    expect(required).toEqual([]);
  });

  it("passes on a failure to load the specifier after resolving failed", () => {
    const host: PeerHost = {
      require: () => {
        throw Object.assign(new Error("missing"), { code: "MODULE_NOT_FOUND" });
      },
      resolve: () => {
        throw new TypeError("Invalid arguments");
      },
    };
    expect(() => loadPeer("@cosyte/x", host)).toThrow("missing");
  });

  it("passes on any other failure to load", () => {
    const host: PeerHost = {
      require: () => {
        throw Object.assign(new Error("missing"), { code: "MODULE_NOT_FOUND" });
      },
      resolve: entryUrl,
    };
    expect(() => loadPeer("@cosyte/x", host)).toThrow("missing");
    const nullHost: PeerHost = {
      require: () => {
        // A non-object thrown value is passed on as it is.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw null;
      },
      resolve: entryUrl,
    };
    expect(() => loadPeer("@cosyte/x", nullHost)).toThrow();
  });

  it("requires the specifier itself in the CommonJS build", () => {
    const host: PeerHost = { require: (id) => ({ id }), resolve: undefined };
    expect(loadPeer("@cosyte/x", host)).toEqual({ id: "@cosyte/x" });
  });

  it("loads a peer once, on the first call", () => {
    let loads = 0;
    const host: PeerHost = {
      require: (id) => {
        loads += 1;
        return { id };
      },
      resolve: undefined,
    };
    const peer = lazyPeer<{ id: string }>("@cosyte/x", host);
    expect(loads).toBe(0);
    const first = peer();
    expect(peer()).toBe(first);
    expect(loads).toBe(1);
  });

  it("loads the same parser module an import of it gives", async () => {
    const hl7 = await import("@cosyte/hl7");
    expect(lazyPeer<typeof hl7>("@cosyte/hl7")().parseHL7).toBe(hl7.parseHL7);
  });
});

describe("the C-CDA code-system OIDs written out so the subpath need not load @cosyte/ccda", () => {
  it("are the OIDs @cosyte/ccda exports", async () => {
    const ccda = await import("@cosyte/ccda");
    const codes = await import("../src/ccda/example-codes.js");
    expect([
      codes.LOINC_OID,
      codes.SNOMED_CT_OID,
      codes.RXNORM_OID,
      codes.CVX_OID,
      codes.NCI_ROUTE_OID,
    ]).toEqual([ccda.LOINC, ccda.SNOMED_CT, ccda.RXNORM, ccda.CVX, ccda.NCI_ROUTE]);
  });
});

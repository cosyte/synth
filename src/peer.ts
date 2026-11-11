/**
 * Load a sibling `@cosyte/*` parser the first time a generator needs it, not when its subpath is
 * imported. Each parser is one large module (the HL7 v2 parser alone is about 670 KB), and loading
 * it took most of a subpath's cold import; a caller that imports `@cosyte/synth/hl7` and never
 * generates a message no longer pays for it, and one that does pays once, on the first call.
 *
 * The load is synchronous, so every generator keeps its synchronous signature. It loads the same
 * build an `import` or a `require` of the parser would: the CommonJS build of this package
 * `require`s the parser's CommonJS entry, and the ES module build `require`s the ES module entry
 * that `import` resolves to, so a value a generator returns is an instance of the very classes the
 * caller imports from the parser. That holds on every Node.js release `engines.node` allows (22.12
 * and later). Where Node.js cannot `require` an ES module (before 22.12, or with that turned off),
 * the ES module build falls back to the parser's CommonJS entry: generation still works, but a
 * returned value is an instance of the CommonJS copy of the parser's classes, so `instanceof`
 * against a class imported with `import` is false. The same fallback applies where
 * `import.meta.resolve` throws or answers with a URL that is not a `file:` URL, as inside Deno's
 * test runner.
 *
 * A bundler cannot see this load, since the specifier reaches `require` at run time. Code that
 * bundles this package keeps it and each parser external and installed beside the bundle.
 *
 * @module
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** What a build has for loading a module synchronously. */
export interface PeerHost {
  /** A CommonJS `require` (the module's own in the CommonJS build, one made for the ES build). */
  readonly require: (id: string) => unknown;
  /** Resolve a specifier the way `import` does, to a `file:` URL; absent in the CommonJS build. */
  readonly resolve: ((specifier: string) => string) | undefined;
}

/** The host this build runs in. */
function defaultHost(): PeerHost {
  // The CommonJS build has an empty `import.meta`, and its own `require`.
  /* v8 ignore next -- the CommonJS build only, which `pnpm smoke` and `pnpm check:install` load */
  if (typeof import.meta.resolve !== "function") return { require, resolve: undefined };
  return { require: createRequire(import.meta.url), resolve: (s) => import.meta.resolve(s) };
}

/** Whether an error is Node.js refusing to `require` an ES module. */
function isRequireEsmRefusal(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "ERR_REQUIRE_ESM";
}

/**
 * Load a peer now, through a host: the ES module entry when the host can resolve one and
 * `require` it, the CommonJS entry otherwise.
 *
 * @param specifier - The peer's specifier, e.g. `"@cosyte/hl7"`.
 * @param host - How to load it.
 * @returns The peer's module namespace.
 * @example
 * ```ts
 * loadPeer("@cosyte/hl7", { require, resolve: undefined });
 * ```
 */
export function loadPeer<T>(specifier: string, host: PeerHost): T {
  if (host.resolve === undefined) return host.require(specifier) as T;
  let entry: string;
  try {
    entry = fileURLToPath(host.resolve(specifier));
  } catch {
    // The host could not resolve the specifier to a file: Deno's test runner throws from
    // `import.meta.resolve`, and a resolver may answer with a URL that is not a `file:` URL.
    return host.require(specifier) as T;
  }
  try {
    return host.require(entry) as T;
  } catch (error) {
    if (!isRequireEsmRefusal(error)) throw error;
    return host.require(specifier) as T;
  }
}

/**
 * A getter for a peer that loads it on its first call and returns the same namespace after.
 *
 * @param specifier - The peer's specifier, e.g. `"@cosyte/hl7"`.
 * @param host - How to load it; defaults to this build's own.
 * @returns A function returning the peer's module namespace.
 * @example
 * ```ts
 * const hl7 = lazyPeer<typeof import("@cosyte/hl7")>("@cosyte/hl7");
 * hl7().parseHL7(text);
 * ```
 */
export function lazyPeer<T>(specifier: string, host?: PeerHost): () => T {
  let loaded: T | undefined;
  return () => (loaded ??= loadPeer<T>(specifier, host ?? defaultHost()));
}

#!/usr/bin/env node
/**
 * The CONSUMER-INSTALL gate: installs this package the way a stranger installs it, into a freshly
 * created empty project outside the tracked tree, with npm and with pnpm, and proves the
 * degradation contract that the optional-peer design promises.
 *
 * WHY THIS FILE EXISTS. Every other gate in this repo runs INSIDE the repo, against a workspace
 * whose seven `@cosyte` peers are already on disk as `file:vendor/*.tgz` devDependencies.
 * `pnpm install --frozen-lockfile` resolves those peers from the vendored tarballs, so a green
 * pipeline has never once said anything about what happens when someone with an empty directory
 * types `npm install @cosyte/synth`. That gap was not theoretical: this package spent time
 * published and uninstallable, and the only thing that ever noticed was a person trying it by hand.
 *
 * A PACKAGE THAT INSTALLS TODAY BECAUSE A SIBLING HAPPENED TO PUBLISH, WITH NOTHING WATCHING, IS
 * THE SAME DEFECT WAITING. That is the whole argument for this file. It is not here to assert that
 * the install works; it is here so that when it stops working, something goes red.
 *
 * WHAT IT REFUSES TO REASON FROM. `peerDependenciesMeta` marking a peer optional does NOT imply an
 * install succeeds: npm's resolver has failed on an optional peer it could not fetch, so a manifest
 * reading is not evidence and never substitutes for an install. Every claim this script makes comes
 * from a package manager exit code, an installed file tree, or a `node` process that imported the
 * built package and generated something.
 *
 * THE THREE STATES IT PROVES, all in the same clean project, in order:
 *
 *   1. NO PEER INSTALLED. The install resolves anyway, `node_modules/@cosyte/` holds this package
 *      and nothing else, and the package ROOT imports and generates a synthetic artifact from the
 *      format-agnostic core. The root must never need a parser.
 *   2. PEER ABSENT, SUBPATH IMPORTED. The subpath fails at IMPORT time, not at install time, and
 *      its diagnostic NAMES the missing peer package. A subpath that failed silently, or failed
 *      with a message that did not say which peer to install, would satisfy neither half.
 *   3. PEER PRESENT, SUBPATH IMPORTED. With one peer installed from the registry, that subpath
 *      imports and generates a real fixture through it, while a DIFFERENT subpath whose peer is
 *      still uninstalled keeps failing exactly as in state 2. Both directions in one project, so
 *      neither result can be an artefact of the project being wholly broken or wholly complete.
 *
 * WHY THE PROBES RUN IN A CHILD `node`, NOT IN THIS PROCESS. Resolution is the subject. A dynamic
 * `import()` from this file would resolve against THIS repo's `node_modules`, where all seven peers
 * are present as vendored devDependencies, so every one of the three states above would be
 * unobservable. The probes are written into the clean project and executed with that project as the
 * working directory, which is the only place the answers are real.
 *
 * TWO MODES, ONE SCRIPT, BECAUSE THE TWO GATES ASK THE SAME QUESTION AT DIFFERENT TIMES.
 *   `--mode=pack`     (default) packs THIS tree and installs the resulting tarball. This is the
 *                     pre-merge question: would the change in front of me install?
 *   `--mode=registry` installs `<name>@<version>` from the public registry. This is the
 *                     post-release question: is what we actually shipped installable? The version
 *                     defaults to the one this tree declares, which after a release is the version
 *                     just published and otherwise is the last one that was.
 *
 * A REFUSAL IS A FAILURE HERE, AND THERE IS NO "SKIPPED". If the registry cannot be reached, or does
 * not carry the version asked for, this exits non-zero naming the package and the version. Reporting
 * "could not check" as anything other than red is how a gate becomes decoration: the one outcome
 * worse than a red install check is a green one that did not install anything.
 *
 * WHAT IT WILL NOT DO: write anything into the tracked tree. The packed tarball, the temporary
 * project, its `node_modules` and every generated fixture live under the OS temp directory, which is
 * asserted to be outside this repository before anything is written, and are removed on exit
 * whatever the result. Generated artifacts are held in memory and asserted on; none is ever written
 * to a file, and none is ever printed (this runs in a public Actions log, and a generator whose
 * failure mode is emitting something that looks real should not be teaching anyone to read a
 * plausible identifier out of CI output).
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const NAME = pkg.name;

// ---------------------------------------------------------------------------
// THE SUBJECT: which subpath is proved WITH its peer, and which is proved WITHOUT one.
//
// Both are checked against `package.json`'s `exports`, `peerDependencies` and
// `peerDependenciesMeta` before anything runs, so a subpath that is renamed or unpublished, or a
// peer that stops being declared or stops being optional, REFUSES here instead of quietly dropping
// out of the gate. Two DIFFERENT subpaths on purpose: proving the same one in both states in
// sequence would let an install-order effect masquerade as the contract holding.

/** The subpath whose peer this check installs, plus the call that proves it generates. */
const PEER_PRESENT = {
  subpath: "./fhir",
  peer: "@cosyte/fhir",
  probe:
    "const m = await import(SPEC); out = m.fhirCorpus({ seed: 1, count: 1 }).artifacts[0].content;",
};

/** The subpath whose peer this check deliberately LEAVES UNINSTALLED for the whole run. */
const PEER_ABSENT = {
  subpath: "./ncpdp",
  peer: "@cosyte/ncpdp",
  probe: "const m = await import(SPEC); out = String(Object.keys(m).length);",
};

/**
 * The root probe: the format-agnostic core, which must need no peer at all.
 *
 * PHI hygiene, the same rule `scripts/smoke.mjs` follows: this asserts on the generated SSN and
 * never prints it. The value cannot be real, but this runs in a public log.
 */
const ROOT_PROBE = `const m = await import(SPEC);
const ssn = m.safe.ssn(m.createRng(7));
if (!m.isSyntheticSsn(ssn)) throw new Error("root: isSyntheticSsn(safe.ssn(createRng(7))) was false");
out = String(m.VERSION) + ":" + String(ssn.length);`;

// ---------------------------------------------------------------------------
// ARGUMENTS. The flag names avoid npm's and pnpm's own global options (`--registry`, `--version`,
// `--dir`, `--filter`, `--prod`), because these arrive through `pnpm run check:install -- ...` and a
// collision there is resolved in the package manager's favour without saying so.

const DEFAULTS = {
  mode: "pack",
  "pkg-version": "",
  "registry-url": "https://registry.npmjs.org",
  "package-managers": "npm,pnpm",
  retries: "5",
  "retry-base-ms": "2000",
  "retry-cap-ms": "30000",
};

const USAGE = `Usage: node scripts/check-install.mjs [options]

  --mode=pack|registry        pack (default) installs a tarball packed from this tree;
                              registry installs <name>@<version> from the public registry
  --pkg-version=<semver>      registry mode only; defaults to this tree's package.json version
  --registry-url=<url>        default ${DEFAULTS["registry-url"]}
  --package-managers=<list>   comma separated, npm and pnpm; default ${DEFAULTS["package-managers"]}
  --retries=<n>               attempts before a registry step fails; default ${DEFAULTS.retries}
  --retry-base-ms=<ms>        first backoff, doubling; default ${DEFAULTS["retry-base-ms"]}
  --retry-cap-ms=<ms>         backoff ceiling; default ${DEFAULTS["retry-cap-ms"]}
  --keep                      leave the scratch directory in place for inspection

Through the package script, with or without the separator:
  pnpm run check:install -- --mode=registry
  pnpm run check:install --mode=registry`;

function usageError(msg) {
  console.error(`check:install: ${msg}\n\n${USAGE}`);
  process.exit(2);
}

const opts = { ...DEFAULTS, keep: false };
for (const arg of process.argv.slice(2)) {
  // `pnpm run check:install -- --mode=registry` FORWARDS the separator rather than eating it
  // (measured: the script receives `["--", "--mode=registry"]`), so a bare `--` is dropped here.
  // Rejecting it would make the documented invocation fail on its own punctuation.
  if (arg === "--") continue;
  if (arg === "--keep") {
    opts.keep = true;
    continue;
  }
  const m = /^--([a-z-]+)=(.*)$/.exec(arg);
  if (m === null || !Object.hasOwn(DEFAULTS, m[1])) usageError(`unrecognised argument \`${arg}\``);
  opts[m[1]] = m[2];
}
if (opts.mode !== "pack" && opts.mode !== "registry") {
  usageError(`--mode must be \`pack\` or \`registry\`, got \`${opts.mode}\``);
}

const RETRIES = Number.parseInt(opts.retries, 10);
const RETRY_BASE_MS = Number.parseInt(opts["retry-base-ms"], 10);
const RETRY_CAP_MS = Number.parseInt(opts["retry-cap-ms"], 10);
if (!Number.isInteger(RETRIES) || RETRIES < 1) usageError("--retries must be an integer >= 1");
if (!Number.isInteger(RETRY_BASE_MS) || RETRY_BASE_MS < 0) {
  usageError("--retry-base-ms must be an integer >= 0");
}
if (!Number.isInteger(RETRY_CAP_MS) || RETRY_CAP_MS < 0) {
  usageError("--retry-cap-ms must be an integer >= 0");
}

const PACKAGE_MANAGERS = opts["package-managers"]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (PACKAGE_MANAGERS.length === 0) {
  usageError(
    "--package-managers resolved to an empty list, which would pass without installing anything",
  );
}
for (const pm of PACKAGE_MANAGERS) {
  if (pm !== "npm" && pm !== "pnpm")
    usageError(`--package-managers accepts npm and pnpm, got \`${pm}\``);
}

const WANTED_VERSION = opts["pkg-version"] === "" ? pkg.version : opts["pkg-version"];
const REGISTRY = opts["registry-url"].replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// OUTCOMES. Three of them, and the difference between the last two is the whole point.

let failures = 0;
const log = (msg) => {
  console.log(`check:install: ${msg}`);
};
const indent = (text) => `  ${text.trim().split("\n").join("\n  ")}`;

/** A contract this check proved did not hold. The build, or the published package, is wrong. */
function fail(msg) {
  console.error(`check:install: FAIL - ${msg}`);
  failures += 1;
}

/**
 * This check could not do its job. Exits NON-ZERO on purpose and prints no verdict, because an "ok"
 * from a run that installed nothing, and a "skipped" that a pipeline reads as green, are both worse
 * than the red.
 */
function refuse(msg) {
  console.error(`check:install: REFUSING TO REPORT\n${indent(msg)}`);
  cleanup();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SCRATCH SPACE, asserted to be outside the tracked tree before a byte is written.

let scratch = null;
function cleanup() {
  if (scratch === null) return;
  if (opts.keep) {
    log(`--keep: scratch left at ${scratch}`);
    return;
  }
  rmSync(scratch, { recursive: true, force: true });
  scratch = null;
}
process.on("exit", cleanup);

function makeScratch() {
  const base = resolve(tmpdir());
  const rel = relative(ROOT, base);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    refuse(
      `the OS temp directory (${base}) is inside this repository (${ROOT}). This check creates ` +
        `projects, installs node_modules and packs a tarball there, and every one of them would ` +
        `land in the tracked tree. Set TMPDIR to a path outside the repository and re-run.`,
    );
  }
  scratch = mkdtempSync(join(base, "cosyte-check-install-"));
  return scratch;
}

// ---------------------------------------------------------------------------
// RUNNING THINGS.

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    timeout: 20 * 60 * 1000,
  });
  return {
    status: r.error ? null : r.status,
    error: r.error ? String(r.error) : null,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    output: `${r.stdout ?? ""}${r.stderr ?? ""}`,
  };
}

/**
 * Text that means a resolution went wrong even when the package manager still exited 0.
 *
 * THE EXIT CODE IS NOT ENOUGH. pnpm reports peer problems as warnings and exits 0 under its default
 * `strict-peer-dependencies=false`, which is exactly the setting a consumer has, so a peer failure
 * would otherwise pass here. And the fix is deliberately NOT to switch strictness on in the
 * throwaway project: that would change the resolution being measured into one no consumer performs,
 * and what a consumer gets is the entire question this file asks.
 */
const RESOLUTION_FAILURE_PATTERNS = [
  /ERESOLVE/,
  /could not resolve dependency/i,
  /unable to resolve dependency tree/i,
  /ERR_PNPM_PEER_DEP_ISSUES/,
  /Issues with peer dependencies found/i,
  /unmet peer/i,
  /missing peer/i,
  /peer dep missing/i,
];

/**
 * Text that means the attempt failed for a reason another attempt could fix: the registry was
 * unreachable, or does not carry the version YET.
 *
 * THE BUDGET EXISTS FOR ONE REASON, PUBLISH PROPAGATION: a version is not readable from every
 * registry edge the instant `npm publish` returns. Everything else is deterministic and retrying it
 * only turns a fast red into a slow one, so an ERESOLVE is reported on the first attempt.
 */
const TRANSIENT_PATTERNS = [
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /ESOCKETTIMEDOUT/i,
  /network|socket hang up|request to .* failed/i,
  /ERR_PNPM_META_FETCH_FAIL/,
  /ERR_PNPM_REGISTRIES_MISMATCH/,
  /ERR_PNPM_NO_MATCHING_VERSION/,
  /\bE404\b|\bETARGET\b/,
  /No matching version found/i,
  /is not in this registry/i,
  /HTTP status 5\d\d|\b5\d\d Internal|\bBad Gateway\b|\bService Unavailable\b/i,
];

const isTransient = (output) => TRANSIENT_PATTERNS.some((re) => re.test(output));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry a registry-touching step within the budget. Exhausting the budget is a FAILURE and never a
 * pass, which is why this returns the last attempt rather than swallowing it.
 */
async function withRetry(label, attempt) {
  let last = { ok: false, detail: "not attempted", attempts: 0 };
  for (let i = 1; i <= RETRIES; i += 1) {
    last = { ...(await attempt(i)), attempts: i };
    if (last.ok || last.transient === false) return last;
    if (i < RETRIES) {
      const wait = Math.min(RETRY_BASE_MS * 2 ** (i - 1), RETRY_CAP_MS);
      log(
        `${label}: attempt ${String(i)}/${String(RETRIES)} failed (${last.detail}); retry in ${String(wait)}ms`,
      );
      await sleep(wait);
    }
  }
  return last;
}

// ---------------------------------------------------------------------------
// REGISTRY PREFLIGHT. Separate from the install so that "the registry does not carry this version"
// and "the package manager could not install it" are distinguishable in the output, and so the
// package name and the version are named in the diagnostic even when the package manager's own
// error is terse.

let lastPackument = null;

async function versionOnRegistry() {
  const url = `${REGISTRY}/${NAME.replace("/", "%2f")}`;
  return withRetry("registry preflight", async () => {
    let res;
    try {
      res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      return { ok: false, detail: `${url} could not be reached: ${String(err?.message ?? err)}` };
    }
    if (res.status === 404) return { ok: false, detail: `${REGISTRY} has no package ${NAME}` };
    if (!res.ok) return { ok: false, detail: `${url} answered HTTP ${String(res.status)}` };
    try {
      lastPackument = await res.json();
    } catch (err) {
      return {
        ok: false,
        detail: `${url} answered unparseable JSON: ${String(err?.message ?? err)}`,
      };
    }
    if (Object.hasOwn(lastPackument.versions ?? {}, WANTED_VERSION)) return { ok: true };
    return { ok: false, detail: `${REGISTRY} does not carry ${NAME}@${WANTED_VERSION}` };
  });
}

// ---------------------------------------------------------------------------
// DERIVING THE SUBJECT from package.json, so the gate cannot drift off the published surface.

function assertSubject() {
  const exportKeys = Object.keys(pkg.exports ?? {});
  const peers = pkg.peerDependencies ?? {};
  const optional = pkg.peerDependenciesMeta ?? {};
  for (const { subpath, peer } of [PEER_PRESENT, PEER_ABSENT]) {
    if (!exportKeys.includes(subpath)) {
      refuse(
        `package.json \`exports\` no longer publishes "${subpath}", which this check uses to prove ` +
          `the optional-peer degradation contract. Point the constant at a subpath that is still ` +
          `published, in the same change that removed this one.`,
      );
    }
    if (!Object.hasOwn(peers, peer)) {
      refuse(
        `package.json no longer declares "${peer}" in \`peerDependencies\`, so this check would be ` +
          `proving a degradation contract the manifest no longer makes.`,
      );
    }
    if (optional[peer]?.optional !== true) {
      refuse(
        `"${peer}" is no longer declared optional in \`peerDependenciesMeta\`. A REQUIRED peer ` +
          `changes what a consumer install must do, and this check's three states assume optional.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// BUILDING THE INSTALL TARGET.

function packTarball(dir) {
  if (!existsSync(join(ROOT, "dist"))) {
    refuse(
      "`dist/` does not exist, so a pack would produce a tarball with no entry points and this " +
        "check would report on an empty package. Run `pnpm build` first.",
    );
  }
  // `--ignore-scripts` is deliberate and does not change the tarball: `files` decides the contents,
  // and this package's only pack-time lifecycle script installs git hooks (`prepare`:
  // simple-git-hooks). Nothing here builds during pack, which is why the build is its own step
  // before this one rather than a `prepare`. Ignoring scripts keeps the gate hermetic.
  const r = run("npm", ["pack", "--pack-destination", dir, "--ignore-scripts"], ROOT);
  if (r.status !== 0) {
    refuse(
      `\`npm pack\` failed (exit ${String(r.status)}, error ${String(r.error)}):\n${indent(r.output)}`,
    );
  }
  const produced = readdirSync(dir).filter((f) => f.endsWith(".tgz"));
  if (produced.length !== 1) {
    refuse(
      `\`npm pack\` was expected to produce exactly one tarball in ${dir}, found ` +
        `${String(produced.length)} (${produced.join(", ") || "none"}).`,
    );
  }
  return join(dir, produced[0]);
}

// ---------------------------------------------------------------------------
// THE CLEAN PROJECT.

function makeProject(dir, pm) {
  mkdirSync(dir, { recursive: true });
  const manifest = {
    name: `consumer-probe-${pm}`,
    version: "0.0.0",
    private: true,
    type: "module",
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // Pin the registry, so "the public registry" is a fact about this run rather than about whatever
  // the machine happens to be configured for, and pin `legacy-peer-deps=false`, because a
  // machine-level override of it would mask exactly the ERESOLVE this gate hunts. Nothing else is
  // set: every other resolution setting stays at the package manager's default, which is what a
  // consumer has. In particular `strict-peer-dependencies` is left alone, and peer problems are
  // read out of the output instead.
  writeFileSync(join(dir, ".npmrc"), `registry=${REGISTRY}/\nlegacy-peer-deps=false\n`);
}

async function installInto(dir, pm, spec, label) {
  const result = await withRetry(`${label} (${pm})`, () => {
    const args =
      pm === "npm"
        ? ["install", spec, "--no-fund", "--no-audit"]
        : ["add", spec, "--config.confirmModulesPurge=false"];
    const r = run(pm, args, dir);
    if (r.error !== null)
      return { ok: false, detail: `could not run ${pm}: ${r.error}`, r, transient: false };
    if (r.status !== 0) {
      return {
        ok: false,
        detail: `${pm} exited ${String(r.status)}`,
        r,
        transient: isTransient(r.output),
      };
    }
    return { ok: true, r };
  });

  const output = result.r?.output ?? "";
  if (!result.ok) {
    fail(
      `${label}: ${pm} could not install \`${spec}\` after ${String(result.attempts)} attempt(s) ` +
        `(${result.detail}). Package ${NAME}, version ${WANTED_VERSION}, registry ${REGISTRY}.\n` +
        indent(output || "(no output)"),
    );
    return { ok: false };
  }
  const complaints = RESOLUTION_FAILURE_PATTERNS.filter((re) => re.test(output)).map(
    (re) => re.source,
  );
  if (complaints.length > 0) {
    fail(
      `${label}: ${pm} exited 0 but its output reports a failed peer or dependency resolution ` +
        `(matched ${complaints.join(", ")}). An install that resolved nothing and said so is not a ` +
        `successful install.\n${indent(output)}`,
    );
    return { ok: false };
  }
  log(`${label}: ${pm} installed \`${spec}\` cleanly (exit 0, no ERESOLVE, no peer complaint)`);
  return { ok: true };
}

/** The `@cosyte` scope as it actually sits on disk in the clean project. */
function installedCosytePackages(dir) {
  const scopeDir = join(dir, "node_modules", "@cosyte");
  if (!existsSync(scopeDir)) return [];
  return readdirSync(scopeDir)
    .filter((n) => !n.startsWith("."))
    .sort();
}

/**
 * Run one probe inside the clean project and return what happened.
 *
 * The probe is a FILE in the project rather than `node -e`, so the specifier resolves through the
 * project's own `node_modules` exactly as a consumer's module would, and so the failing case carries
 * a real module-resolution error rather than one manufactured here. A probe that throws still exits
 * 0 and reports the throw as data: this check has to tell "the import failed, correctly" apart from
 * "the harness broke", and an exit code cannot carry that difference.
 */
function probeIn(dir, name, spec, body) {
  const file = join(dir, `probe-${name}.mjs`);
  writeFileSync(
    file,
    `const SPEC = ${JSON.stringify(spec)};
let out;
try {
  ${body}
} catch (err) {
  console.log(JSON.stringify({ ok: false, code: err?.code ?? null, message: String(err?.message ?? err) }));
  process.exit(0);
}
console.log(JSON.stringify({ ok: true, length: typeof out === "string" ? out.length : -1 }));
`,
  );
  const r = run(process.execPath, [file], dir);
  if (r.status !== 0) {
    return {
      harness: true,
      message: `probe process exited ${String(r.status)}:\n${indent(r.output)}`,
    };
  }
  const line = r.stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  try {
    return JSON.parse(line);
  } catch {
    return { harness: true, message: `probe printed no JSON verdict:\n${indent(r.output)}` };
  }
}

/** The absent-peer assertion, used twice: the install resolved, and only the IMPORT fails. */
function expectImportFailsNaming(pm, result, spec, peer) {
  if (result.harness === true) {
    fail(`${pm}: probe harness error for ${spec}: ${result.message}`);
    return;
  }
  if (result.ok) {
    fail(
      `${pm}: importing ${spec} SUCCEEDED with ${peer} not installed, so this run proves nothing ` +
        `about the absent-peer state. Either the subpath no longer needs its peer (and the manifest ` +
        `says otherwise), or the peer arrived on disk some other way.`,
    );
    return;
  }
  if (!String(result.message).includes(peer)) {
    fail(
      `${pm}: importing ${spec} failed, but its diagnostic does not name ${peer}, so a consumer is ` +
        `not told which peer to install:\n${indent(String(result.message))}`,
    );
    return;
  }
  log(`${pm}: ${spec} fails at IMPORT time naming ${peer}, with the install itself intact`);
}

// ---------------------------------------------------------------------------
// THE RUN.

assertSubject();
const scratchRoot = makeScratch();

let spec;
if (opts.mode === "pack") {
  const packDir = join(scratchRoot, "pack");
  mkdirSync(packDir, { recursive: true });
  spec = packTarball(packDir);
  log(`mode=pack: packed ${NAME}@${WANTED_VERSION} from this tree to ${spec}`);
} else {
  const preflight = await versionOnRegistry();
  if (!preflight.ok) {
    const latest = lastPackument?.["dist-tags"]?.latest;
    fail(
      `${NAME}@${WANTED_VERSION} could not be verified on ${REGISTRY} after ` +
        `${String(preflight.attempts)} attempt(s): ${preflight.detail}.` +
        (latest === undefined ? "" : ` The registry's \`latest\` is ${String(latest)}.`) +
        `\n  This is a FAILURE, not a skip and not a pass. A consumer install of ` +
        `${NAME}@${WANTED_VERSION} is what this gate exists to prove, and it has not been proved.`,
    );
    console.error(
      `check:install: ${String(failures)} failure(s); ${NAME}@${WANTED_VERSION} was NOT installed`,
    );
    cleanup();
    process.exit(1);
  }
  spec = `${NAME}@${WANTED_VERSION}`;
  log(`mode=registry: ${spec} is on ${REGISTRY}`);
}

const presentSpec = `${NAME}/${PEER_PRESENT.subpath.slice(2)}`;
const absentSpec = `${NAME}/${PEER_ABSENT.subpath.slice(2)}`;

for (const pm of PACKAGE_MANAGERS) {
  console.log("");
  log(`===== ${pm} =====`);
  const dir = join(scratchRoot, `project-${pm}`);
  makeProject(dir, pm);

  // STATE 1: install into the empty project, with no peer present anywhere.
  if (!(await installInto(dir, pm, spec, "clean-project install")).ok) continue;

  const scoped = installedCosytePackages(dir);
  const strays = scoped.map((n) => `@cosyte/${n}`).filter((n) => n !== NAME);
  if (strays.length > 0) {
    fail(
      `${pm}: the clean install pulled in ${strays.join(", ")}. The peers are declared OPTIONAL so ` +
        `that a consumer who wants only the core does not download seven parsers, and the two ` +
        `states below are only meaningful if the peer really is absent.`,
    );
    continue;
  }
  log(`${pm}: node_modules/@cosyte holds exactly [${scoped.join(", ")}], so no peer is installed`);

  const rootResult = probeIn(dir, "root", NAME, ROOT_PROBE);
  if (rootResult.ok === true && rootResult.length > 0) {
    log(`${pm}: importing ${NAME} with zero peers installed generated a synthetic artifact`);
  } else {
    fail(
      `${pm}: importing ${NAME} with no peer installed did not generate from the format-agnostic ` +
        `core: ${String(rootResult.message ?? "empty output")}`,
    );
  }

  // STATE 2: the subpath whose peer is about to be installed, while it is still absent.
  expectImportFailsNaming(
    pm,
    probeIn(dir, "present-peer-before", presentSpec, PEER_PRESENT.probe),
    presentSpec,
    PEER_PRESENT.peer,
  );

  // STATE 3: install that one peer. The subpath must now import and generate through it.
  if ((await installInto(dir, pm, `${PEER_PRESENT.peer}@latest`, "peer install")).ok) {
    const after = probeIn(dir, "present-peer-after", presentSpec, PEER_PRESENT.probe);
    if (after.ok === true && after.length > 0) {
      log(
        `${pm}: ${presentSpec} imported and generated ${String(after.length)} bytes through ` +
          `${PEER_PRESENT.peer}`,
      );
    } else {
      fail(
        `${pm}: with ${PEER_PRESENT.peer} installed, ${presentSpec} still did not generate: ` +
          `${String(after.message ?? "empty output")}`,
      );
    }
  }

  // And the OTHER subpath, whose peer was never installed, still degrades the same way.
  expectImportFailsNaming(
    pm,
    probeIn(dir, "absent-peer", absentSpec, PEER_ABSENT.probe),
    absentSpec,
    PEER_ABSENT.peer,
  );
}

console.log("");
cleanup();
if (failures > 0) {
  console.error(
    `check:install: ${String(failures)} failure(s) across [${PACKAGE_MANAGERS.join(", ")}]`,
  );
  process.exit(1);
}
console.log(
  `check:install: ok - ${NAME}@${WANTED_VERSION} (${opts.mode === "pack" ? "packed from this tree" : `from ${REGISTRY}`}) ` +
    `installs into an empty project with [${PACKAGE_MANAGERS.join(", ")}]; the root generates with no ` +
    `peer installed; ${presentSpec} generates once ${PEER_PRESENT.peer} is present; ${absentSpec} ` +
    `resolves at install and fails only on import, naming ${PEER_ABSENT.peer}`,
);

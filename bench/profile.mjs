// The parts of the audit a reading cannot give, against the built entry:
//   pnpm build && pnpm bench:profile [--out <dir>]
//
// 1. Memory and single-call time of every size of at least 1,000 artifacts. Each case runs in a
//    fresh process: it settles the heap, resets the process's resident high water mark (Linux,
//    /proc/self/clear_refs), makes one call while holding the result, and reads the high water mark
//    back. That peak is every byte the call made resident, transient garbage included, over the
//    bytes it generated. What the result still holds after a full collection is read beside it:
//    that is what a caller who keeps the corpus pays. The same process times that first call and
//    the median of 3 warm calls, which is the single-call time of the sizes whose warmup a reading
//    cannot settle.
// 2. Throughput from each shape's smallest size to its largest, timed the same simple way for every
//    size: warmed, then the median of 7 samples of whole passes.
// 3. The cost of a seed: what seeding a stream costs against a draw, and its share of one artifact.
// 4. The cold import of each subpath, the one a consumer writes (`@cosyte/synth/hl7`), in fresh
//    processes against an empty module, and the bytes each loads, gzipped. A reading imports the
//    root entry only, which loads no parser.
// 5. A CPU profile and a sampled heap profile of the hottest paths, with the top functions of each.
//    Each workload is warmed, then profiled alone for two seconds through the inspector. With
//    --enable-source-maps a function is named by its src/ file and line.
//
// `--out <dir>` writes profile.md there with every .cpuprofile and .heapprofile, for a profiler's
// own view (Chrome DevTools, speedscope). The inputs are the bench's own: seeds and counts, so every
// value is synthetic.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { findSourceMap } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { corpusBytes, FORMATS, formatOf, patients, seedStreams } from "./shapes.mjs";
import { bindShape, inputsOf, SHAPES } from "./synth.bench.mjs";

const PROFILE_MS = 2_000;
const WARMUP_MS = 500;
const TOP = 10;
/** Sizes below this many artifacts are left to the reading: the resident set moves in pages. */
const MEMORY_MIN_COUNT = 1_000;
const IMPORT_PROCESSES = 15;

function args(argv) {
  const out = { target: argv[0], dir: undefined, memoryCase: undefined, importCase: undefined };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--out") out.dir = argv[++i];
    else if (argv[i] === "--memory-case") out.memoryCase = argv[++i];
    else if (argv[i] === "--import-case") out.importCase = argv[++i];
  }
  return out;
}

/** The bytes a call's result holds as text: a corpus's artifacts, or the identities as JSON. */
function bytesOfResult(result) {
  return Array.isArray(result) ? Buffer.byteLength(JSON.stringify(result)) : corpusBytes(result);
}

function status(field) {
  const line = readFileSync("/proc/self/status", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${field}:`));
  if (line === undefined) throw new Error(`no ${field} in /proc/self/status`);
  return Number.parseInt(line.slice(field.length + 1), 10) * 1024;
}

function settle() {
  for (let i = 0; i < 6; i++) globalThis.gc();
}

/** The child half of section 1: one case, one fresh process, printed as JSON. */
function memoryCase(synth, spec) {
  const [shapeIndex, sizeIndex] = spec.split(":").map(Number);
  const shape = SHAPES[shapeIndex];
  const sz = shape.sizes[sizeIndex];
  const call = bindShape(synth, shape);
  const input = { seed: 1, count: sz.count };
  settle();
  const before = process.memoryUsage();
  writeFileSync("/proc/self/clear_refs", "5");
  const rssBefore = status("VmRSS");
  const start = performance.now();
  let result = call(input);
  const firstMs = performance.now() - start;
  const peak = status("VmHWM") - rssBefore;
  settle();
  const after = process.memoryUsage();
  const bytes = bytesOfResult(result);
  result = undefined;
  const warm = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    call(input);
    warm.push(performance.now() - t);
  }
  warm.sort((a, b) => a - b);
  return {
    count: sz.count,
    bytes,
    peakResidentBytes: peak,
    retainedHeapBytes: after.heapUsed - before.heapUsed,
    firstCallMs: firstMs,
    warmCallMs: warm[1],
  };
}

function mib(bytes) {
  if (Math.abs(bytes) >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function ms(value) {
  return value >= 100 ? `${value.toFixed(0)} ms` : `${value.toFixed(2)} ms`;
}

const self = fileURLToPath(import.meta.url);

function child(target, flag, spec) {
  const out = execFileSync(process.execPath, ["--expose-gc", self, target, flag, spec], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(out);
}

/** Section 1: every size of at least `MEMORY_MIN_COUNT` artifacts, each in its own process. */
function memorySection(target) {
  const lines = [
    "### Peak memory, what a corpus holds, and single-call time",
    "",
    "One call in a fresh process, seed 1: its peak resident memory above the resident set before it (every byte, transient garbage included) over the bytes it generated; what the result still holds on the V8 heap after a full collection, over the same bytes; the first call's time, and the median of 3 warm calls. Sizes under 1,000 artifacts are left to the reading.",
    "",
    "| Benchmark | Size | Generated | Peak resident | Multiple | Held, heap | Multiple | First call | Warm call |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const [s, shape] of SHAPES.entries()) {
    for (const [z, sz] of shape.sizes.entries()) {
      if (sz.count < MEMORY_MIN_COUNT) continue;
      const r = child(target, "--memory-case", `${String(s)}:${String(z)}`);
      lines.push(
        `| ${shape.fn}: ${shape.name} | ${sz.label} | ${mib(r.bytes)} | ${mib(r.peakResidentBytes)} | ${(r.peakResidentBytes / r.bytes).toFixed(2)}x | ${mib(r.retainedHeapBytes)} | ${(r.retainedHeapBytes / r.bytes).toFixed(2)}x | ${ms(r.firstCallMs)} | ${ms(r.warmCallMs)} |`,
      );
    }
  }
  return lines;
}

/** Run `pass` until `duration` milliseconds have gone by; returns how many passes ran. */
function runFor(pass, duration) {
  const end = performance.now() + duration;
  let passes = 0;
  while (performance.now() < end) {
    pass();
    passes++;
  }
  return passes;
}

const SAMPLES = 7;
const SAMPLE_MS = 100;

/** Milliseconds a pass, one sample: whole passes until at least `SAMPLE_MS` have gone by. */
function sample(pass) {
  const start = performance.now();
  let passes = 0;
  while (performance.now() - start < SAMPLE_MS) {
    pass();
    passes++;
  }
  return (performance.now() - start) / passes;
}

/** The median milliseconds a pass of `pass`, warmed, one workload at a time. */
function msPerPass(pass) {
  runFor(pass, WARMUP_MS);
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) samples.push(sample(pass));
  samples.sort((a, b) => a - b);
  return samples[Math.floor(SAMPLES / 2)];
}

/** Section 2: bytes a second at each shape's smallest and largest size. */
function throughputSection(synth) {
  const lines = [
    "### Throughput, smallest size against largest",
    "",
    `A reading cannot time a size whose warmup does not settle within its bound, and skips it. This times every size the same simpler way: warmed for ${String(WARMUP_MS)} ms, then the median of ${String(SAMPLES)} samples of at least ${String(SAMPLE_MS)} ms of whole passes over the size's inputs, one size at a time, in one process.`,
    "",
    "| Benchmark | Smallest | Largest | Bytes/s, smallest | Bytes/s, largest | Kept |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const shape of SHAPES) {
    const call = bindShape(synth, shape);
    const rate = (sz) => {
      const inputs = inputsOf(sz);
      const bytes = inputs.reduce((n, x) => n + bytesOfResult(call(x)), 0);
      return bytes / (msPerPass(() => inputs.map(call)) / 1000);
    };
    const first = shape.sizes[0];
    const last = shape.sizes[shape.sizes.length - 1];
    const small = rate(first);
    const large = rate(last);
    lines.push(
      `| ${shape.fn}: ${shape.name} | ${first.label} | ${last.label} | ${mib(small)}/s | ${mib(large)}/s | ${((large / small) * 100).toFixed(0)}% |`,
    );
  }
  return lines;
}

/** Section 3: what a seed costs, against a draw and against one artifact. */
function seedSection(synth) {
  const seeds = Array.from({ length: 10_000 }, (_v, i) => i + 1);
  const rng = synth.createRng(1);
  const seedNs = (msPerPass(() => seedStreams(synth, seeds)) * 1e6) / seeds.length;
  const drawNs =
    (msPerPass(() => {
      let sum = 0;
      for (let i = 0; i < 10_000; i++) sum += rng.nextUint32() & 1;
      return sum;
    }) *
      1e6) /
    10_000;
  const lines = [
    "### The cost of a seed",
    "",
    `Seeding a stream and drawing once: ${seedNs.toFixed(1)} ns a seed. One draw from a seeded stream: ${drawNs.toFixed(1)} ns. A seed costs ${(seedNs / drawNs).toFixed(1)} draws.`,
    "",
    "| Benchmark | One artifact | A seed's share |",
    "| --- | --- | --- |",
  ];
  for (const shape of SHAPES) {
    const call = bindShape(synth, shape);
    const inputs = inputsOf(shape.sizes[0]);
    const perArtifactNs = (msPerPass(() => inputs.map(call)) * 1e6) / inputs.length;
    // A corpus seeds its own stream and then one per artifact; patients seed one per identity too.
    lines.push(
      `| ${shape.fn}: ${shape.name} | ${(perArtifactNs / 1000).toFixed(1)} us | ${(((2 * seedNs) / perArtifactNs) * 100).toFixed(3)}% |`,
    );
  }
  return lines;
}

/** The child half of section 4: one cold import, in milliseconds, and the files it loaded. */
async function importCase(target, which) {
  const url =
    which === "empty"
      ? "data:text/javascript,export default 1"
      : which === "root"
        ? pathToFileURL(resolve(target)).href
        : pathToFileURL(resolve(dirname(target), which, "index.mjs")).href;
  const start = performance.now();
  await import(url);
  const importMs = performance.now() - start;
  return { importMs };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Section 4: the cold import of the root and of each subpath, against an empty module. */
function importSection(target) {
  const lines = [
    "### Cold import of each entry point",
    "",
    `Median of ${String(IMPORT_PROCESSES)} fresh processes each, interleaved with an empty module's import; the time is the import alone, in the process, after Node has started. The bytes are the entry's own file and the parser package entry it imports, gzipped at level 9.`,
    "",
    "| Entry point | Median | Above an empty module | Entry, gzipped | Parser it loads, gzipped |",
    "| --- | --- | --- | --- | --- |",
  ];
  const entries = ["root", ...Object.keys(FORMATS), "deid"];
  const times = new Map(entries.map((e) => [e, []]));
  const empty = [];
  for (let i = 0; i < IMPORT_PROCESSES; i++) {
    for (const e of entries) {
      empty.push(child(target, "--import-case", "empty").importMs);
      times.get(e).push(child(target, "--import-case", e).importMs);
    }
  }
  const emptyMs = median(empty);
  const dist = dirname(resolve(target));
  for (const e of entries) {
    const file = e === "root" ? resolve(dist, "index.mjs") : resolve(dist, e, "index.mjs");
    const gz = gzipSync(readFileSync(file), { level: 9 }).length;
    let parser = "none";
    if (e !== "root") {
      const pkg = e === "deid" ? "@cosyte/deid" : `@cosyte/${e}`;
      try {
        const parserFile = fileURLToPath(import.meta.resolve(pkg));
        parser = `${pkg}, ${mib(gzipSync(readFileSync(parserFile), { level: 9 }).length)}`;
      } catch {
        parser = `${pkg}, not resolved`;
      }
    }
    const m = median(times.get(e));
    lines.push(
      `| ${e === "root" ? "@cosyte/synth" : `@cosyte/synth/${e}`} | ${ms(m)} | ${ms(m - emptyMs)} | ${mib(gz)} | ${parser} |`,
    );
  }
  lines.push("", `An empty module's import: median ${ms(emptyMs)}.`);
  return lines;
}

/** Where a call frame is: its src/ file and line through the source map when there is one. */
function locate(frame) {
  const line = frame.lineNumber;
  if (frame.url === "") return "(native)";
  let where = frame.url;
  try {
    const path = frame.url.startsWith("file:") ? fileURLToPath(frame.url) : frame.url;
    const map = findSourceMap(path);
    const entry = map?.findEntry(line, frame.columnNumber);
    if (entry !== undefined && entry.originalSource !== undefined) {
      const source = entry.originalSource.replace(/^.*?(src\/)/, "$1");
      const pkg = /node_modules\/(@cosyte\/[^/]+)\//.exec(path);
      return `${pkg === null ? "" : `${pkg[1]} `}${source}:${String(entry.originalLine + 1)}`;
    }
    where = path.replace(/^.*?(node_modules\/(?!\.pnpm)|dist\/|bench\/)/, "$1");
    where = where.replace(/^.*node_modules\//, "");
  } catch {
    // An unparseable URL keeps its own text.
  }
  return `${where}:${String(line + 1)}`;
}

function key(frame) {
  return `${frame.functionName === "" ? "(anonymous)" : frame.functionName} ${locate(frame)}`;
}

function isProfilerFrame(frame) {
  return (
    frame.url.startsWith("node:inspector") ||
    frame.functionName === "(program)" ||
    frame.functionName === "(idle)"
  );
}

/** Self time by function, from a CPU profile: the share of samples each one was on top. */
function topSelfTime(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const totals = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    if (isProfilerFrame(node.callFrame)) continue;
    const dt = profile.timeDeltas[i] ?? 0;
    total += dt;
    const k = key(node.callFrame);
    totals.set(k, (totals.get(k) ?? 0) + dt);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, us]) => ({ name, share: us / total }));
}

/** Bytes allocated by function, from a sampled heap profile (sampled, so an estimate). */
function topAllocations(profile) {
  const totals = new Map();
  let total = 0;
  const walk = (node) => {
    if (!isProfilerFrame(node.callFrame) && node.selfSize > 0) {
      const k = key(node.callFrame);
      totals.set(k, (totals.get(k) ?? 0) + node.selfSize);
      total += node.selfSize;
    }
    for (const c of node.children) walk(c);
  };
  walk(profile.head);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, bytes]) => ({ name, share: total === 0 ? 0 : bytes / total }));
}

/** Section 5: the hottest paths, profiled one at a time. */
async function profileSection(synth, dir) {
  const corpus = (format, options = {}) => {
    const fn = formatOf(synth, format)[FORMATS[format]];
    return (count) => fn({ seed: 1, count, ...options });
  };
  const hl7 = corpus("hl7");
  const fhir = corpus("fhir");
  const bundles = corpus("fhir", { mix: ["DocumentBundle"] });
  const ccda = corpus("ccda");
  const x12 = corpus("x12");
  const workloads = [
    { name: "hl7Corpus: 1,000 HL7 v2 messages", pass: () => hl7(1_000).artifacts.length },
    { name: "fhirCorpus: 1,000 FHIR resources", pass: () => fhir(1_000).artifacts.length },
    { name: "fhirCorpus: 100 FHIR document Bundles", pass: () => bundles(100).artifacts.length },
    { name: "ccdaCorpus: 100 C-CDA documents", pass: () => ccda(100).artifacts.length },
    { name: "x12Corpus: 1,000 X12 transactions", pass: () => x12(1_000).artifacts.length },
    {
      name: "patient identities: 10,000",
      pass: () => patients(synth, { seed: 1, count: 10_000 }).length,
    },
  ];

  const session = new Session();
  session.connect();
  await session.post("Profiler.enable");
  await session.post("Profiler.setSamplingInterval", { interval: 100 });
  await session.post("HeapProfiler.enable");
  const lines = [
    "### CPU and heap profile of the hottest paths",
    "",
    `Each workload warmed for ${String(WARMUP_MS)} ms, then profiled alone for ${String(PROFILE_MS)} ms: self time from a CPU profile sampled every 100 us, and allocation from a sampled heap profile (an estimate, V8 heap only). A frame in a sibling parser is named by its package.`,
  ];
  for (const [index, w] of workloads.entries()) {
    runFor(w.pass, WARMUP_MS);
    // The heap sampler starts first and stops last, so the CPU profile holds the workload and not
    // the sampler's own start and stop. It keeps what a collection freed, so a function is charged
    // for everything it allocated, not only for what was still alive at the end.
    await session.post("HeapProfiler.startSampling", {
      samplingInterval: 16_384,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    await session.post("Profiler.start");
    const passes = runFor(w.pass, PROFILE_MS);
    const { profile: cpu } = await session.post("Profiler.stop");
    const { profile: heap } = await session.post("HeapProfiler.stopSampling");
    if (dir !== undefined) {
      writeFileSync(resolve(dir, `${String(index + 1)}.cpuprofile`), JSON.stringify(cpu));
      writeFileSync(resolve(dir, `${String(index + 1)}.heapprofile`), JSON.stringify(heap));
    }
    lines.push(
      "",
      `#### ${String(index + 1)}. ${w.name}`,
      "",
      `${String(passes)} passes in at least ${String(PROFILE_MS)} ms.`,
      "",
      "| Self time | Function | Allocated | Function |",
      "| --- | --- | --- | --- |",
    );
    const cpuTop = topSelfTime(cpu);
    const heapTop = topAllocations(heap);
    for (let i = 0; i < TOP; i++) {
      const c = cpuTop[i];
      const h = heapTop[i];
      lines.push(
        `| ${c === undefined ? "" : `${(c.share * 100).toFixed(1)}%`} | ${c === undefined ? "" : `\`${c.name}\``} | ${h === undefined ? "" : `${(h.share * 100).toFixed(1)}%`} | ${h === undefined ? "" : `\`${h.name}\``} |`,
      );
    }
  }
  session.disconnect();
  return lines;
}

async function main() {
  const options = args(process.argv.slice(2));
  if (options.target === undefined) {
    process.stderr.write("usage: node bench/profile.mjs <dist/index.mjs> [--out <dir>]\n");
    return 2;
  }
  if (options.importCase !== undefined) {
    process.stdout.write(JSON.stringify(await importCase(options.target, options.importCase)));
    return 0;
  }
  const synth = await import(pathToFileURL(resolve(options.target)).href);
  if (options.memoryCase !== undefined) {
    process.stdout.write(JSON.stringify(memoryCase(synth, options.memoryCase)));
    return 0;
  }
  if (options.dir !== undefined) mkdirSync(options.dir, { recursive: true });
  const lines = [
    "## @cosyte/synth: memory, throughput, seeds, imports and profile",
    "",
    `Node ${process.version}, ${process.platform}-${process.arch}.`,
    "",
    ...memorySection(options.target),
    "",
    ...throughputSection(synth),
    "",
    ...seedSection(synth),
    "",
    ...importSection(options.target),
    "",
    ...(await profileSection(synth, options.dir)),
  ];
  const text = `${lines.join("\n")}\n`;
  process.stdout.write(text);
  if (options.dir !== undefined) writeFileSync(resolve(options.dir, "profile.md"), text);
  return 0;
}

process.exitCode = await main();

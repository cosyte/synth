/**
 * The shipped **clearly-fake name pool** — `@cosyte/synth`'s own license-clean synthetic data.
 *
 * Deliberately **not** a `faker`-style realistic-name corpus (which could match a real person at a real
 * address — the exact hazard the synthetic-safety invariant forbids, roadmap §2, §4.3). Every token is
 * an obviously-invented, fixture-flavoured word: a reader can tell at a glance it names no one. The pool
 * is small on purpose — structural coverage, not demographic realism, is the goal.
 *
 * `# synthetic: true`
 *
 * @module
 */

/** Obviously-synthetic given names. None is a plausible real person's name. */
export const SYNTHETIC_GIVEN_NAMES: readonly string[] = Object.freeze([
  "Testina",
  "Fixtura",
  "Synthos",
  "Placeholda",
  "Sampleton",
  "Prototius",
  "Stubbina",
  "Exampla",
  "Quilliam",
  "Fabrica",
  "Simula",
  "Testry",
  "Seedwin",
  "Corpora",
  "Reprodo",
  "Mocktavia",
  "Dummett",
  "Voidwin",
  "Deteria",
  "Randomir",
]);

/** Obviously-synthetic family names. None is a plausible real surname at a real address. */
export const SYNTHETIC_FAMILY_NAMES: readonly string[] = Object.freeze([
  "Testerson",
  "Fauxman",
  "Placeholt",
  "Mockridge",
  "Fixtingham",
  "Synthwell",
  "Dummerton",
  "Examplewood",
  "Fabricant",
  "Simulacre",
  "Nonesuch",
  "Seedman",
  "Corpusworth",
  "Reprodus",
  "Voidmark",
  "Deterwood",
  "Randomson",
  "Quillfeather",
  "Notreal",
  "Genfield",
]);

/** Obviously-synthetic street names for structured address fields. */
export const SYNTHETIC_STREET_NAMES: readonly string[] = Object.freeze([
  "Fixture Lane",
  "Sample Street",
  "Placeholder Avenue",
  "Synthetic Way",
  "Example Boulevard",
  "Testing Terrace",
  "Mock Road",
  "Prototype Court",
]);

/**
 * Obviously-synthetic city names. Combined only ever with a synthetic street + a fake name (the
 * *combination* is what identifies, and the combination is always synthetic — roadmap §4.3).
 */
export const SYNTHETIC_CITY_NAMES: readonly string[] = Object.freeze([
  "Faketon",
  "Synthville",
  "Exampleburg",
  "Testford",
  "Mockhaven",
  "Fixtureton",
]);

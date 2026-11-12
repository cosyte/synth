import { join } from "node:path";

import { checkDocsContent, readDocsContent } from "@cosyte/script-utils/docs-content";
import { describe, expect, it } from "vitest";

/**
 * The docs-content standard's rules on Diataxis kinds, held at zero for this package.
 *
 * `cosyte-docs-content` lets a library keep the findings its shared ratchet records, so a page that
 * mixes kinds again would still pass there until the shared count is lowered. These rules are at
 * zero here, and this test keeps them there: a how-to with no steps or a title that is not a task,
 * an explanation with a settings table or numbered steps, a limitations section outside the one
 * limitations page in Reference, or a tutorial whose sections are not numbered steps ending in
 * "What you built" and "Next".
 */
const root = join(import.meta.dirname, "..");

/** The rules on kinds this package meets in full. */
const KIND_RULES = [
  "howto-title",
  "howto-steps",
  "explanation-content",
  "limitations",
  "tutorial-steps",
] as const;

describe("the docs pages, by Diataxis kind", () => {
  const input = readDocsContent(root);
  const findings = checkDocsContent(input);

  it.each(KIND_RULES)("have no %s finding", (rule) => {
    const found = findings
      .filter((finding) => finding.rule === rule)
      .map((finding) => `${finding.file}:${String(finding.line)} ${finding.message}`);
    expect(found).toEqual([]);
  });

  it("have one limitations page, in Reference", () => {
    const sidebars = JSON.parse(input.sidebars ?? "{}") as {
      docs: (string | { label: string; items: string[] })[];
    };
    const homes = sidebars.docs
      .filter((entry) => typeof entry !== "string" && entry.items.includes("limitations"))
      .map((entry) => (typeof entry === "string" ? entry : entry.label));
    expect(homes).toEqual(["Reference"]);
    expect(
      input.pages.filter((page) => page.name.includes("limitation")).map((p) => p.name),
    ).toEqual(["limitations"]);
  });

  it("name the golden fixture page for what it is, not for its kind", () => {
    const names = input.pages.map((page) => page.name);
    expect(names).toContain("pin-a-golden-fixture");
    expect(names).not.toContain("guides-overview");
  });
});

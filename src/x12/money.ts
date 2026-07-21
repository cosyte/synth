/**
 * Shared money helpers for the X12 generators. X12 amounts are {@link "@cosyte/x12".X12Decimal}, never
 * a float (float arithmetic destroys cents), so every generated charge / payment / adjustment is
 * constructed through {@link dec} — a single, tested conversion point rather than a per-generator
 * duplicate.
 *
 * @module
 */

import { X12Decimal } from "@cosyte/x12";

/**
 * A non-null `X12Decimal` from a decimal string. Throws on an unparseable string — the generators only
 * ever pass literals or `${n}.00` strings, so the throw is a defensive guard, never a runtime path.
 *
 * @param value - A decimal string, e.g. `"150.00"`.
 * @returns The parsed {@link "@cosyte/x12".X12Decimal}.
 * @throws If `value` is not a valid X12 decimal.
 * @example
 * ```ts
 * import { dec } from "@cosyte/synth/x12";
 * dec("150.00"); // X12Decimal
 * ```
 */
export function dec(value: string): X12Decimal {
  const d = X12Decimal.fromString(value);
  if (d === undefined) throw new Error(`invalid synthetic decimal: ${value}`);
  return d;
}

/**
 * A whole-dollar `${n}.00` money string.
 *
 * @param n - The whole-dollar amount.
 * @returns The `${n}.00` string.
 * @example
 * ```ts
 * import { money } from "@cosyte/synth/x12";
 * money(150); // "150.00"
 * ```
 */
export function money(n: number): string {
  return `${String(n)}.00`;
}

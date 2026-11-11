/**
 * The sibling parsers each format builds through, each loaded on its first use (see `./peer.ts`).
 * Every one is an optional peer dependency, needed only by the subpath that generates its format.
 *
 * @module
 */

import type * as Astm from "@cosyte/astm";
import type * as Ccda from "@cosyte/ccda";
import type * as Deid from "@cosyte/deid";
import type * as DeidCcda from "@cosyte/deid/ccda";
import type * as DeidFhir from "@cosyte/deid/fhir";
import type * as DeidHl7 from "@cosyte/deid/hl7";
import type * as DeidNcpdp from "@cosyte/deid/ncpdp";
import type * as DeidX12 from "@cosyte/deid/x12";
import type * as Fhir from "@cosyte/fhir";
import type * as Hl7 from "@cosyte/hl7";
import type * as NcpdpCommon from "@cosyte/ncpdp/common";
import type * as NcpdpScript from "@cosyte/ncpdp/script";
import type * as NcpdpTelecom from "@cosyte/ncpdp/telecom";
import type * as X12 from "@cosyte/x12";

import { lazyPeer } from "./peer.js";

/** `@cosyte/hl7`, loaded on first use. */
export const hl7Peer: () => typeof Hl7 = lazyPeer("@cosyte/hl7");
/** `@cosyte/fhir`, loaded on first use. */
export const fhirPeer: () => typeof Fhir = lazyPeer("@cosyte/fhir");
/** `@cosyte/ccda`, loaded on first use. */
export const ccdaPeer: () => typeof Ccda = lazyPeer("@cosyte/ccda");
/** `@cosyte/x12`, loaded on first use. */
export const x12Peer: () => typeof X12 = lazyPeer("@cosyte/x12");
/** `@cosyte/astm`, loaded on first use. */
export const astmPeer: () => typeof Astm = lazyPeer("@cosyte/astm");
/** `@cosyte/ncpdp/script`, loaded on first use. */
export const ncpdpScriptPeer: () => typeof NcpdpScript = lazyPeer("@cosyte/ncpdp/script");
/** `@cosyte/ncpdp/telecom`, loaded on first use. */
export const ncpdpTelecomPeer: () => typeof NcpdpTelecom = lazyPeer("@cosyte/ncpdp/telecom");
/** `@cosyte/ncpdp/common`, loaded on first use. */
export const ncpdpCommonPeer: () => typeof NcpdpCommon = lazyPeer("@cosyte/ncpdp/common");
/** `@cosyte/deid`, loaded on first use. */
export const deidPeer: () => typeof Deid = lazyPeer("@cosyte/deid");
/** `@cosyte/deid/hl7`, loaded on first use. */
export const deidHl7Peer: () => typeof DeidHl7 = lazyPeer("@cosyte/deid/hl7");
/** `@cosyte/deid/fhir`, loaded on first use. */
export const deidFhirPeer: () => typeof DeidFhir = lazyPeer("@cosyte/deid/fhir");
/** `@cosyte/deid/x12`, loaded on first use. */
export const deidX12Peer: () => typeof DeidX12 = lazyPeer("@cosyte/deid/x12");
/** `@cosyte/deid/ncpdp`, loaded on first use. */
export const deidNcpdpPeer: () => typeof DeidNcpdp = lazyPeer("@cosyte/deid/ncpdp");
/** `@cosyte/deid/ccda`, loaded on first use. */
export const deidCcdaPeer: () => typeof DeidCcda = lazyPeer("@cosyte/deid/ccda");

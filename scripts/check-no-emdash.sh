#!/usr/bin/env bash
# scripts/check-no-emdash.sh
# Brand rule (founder directive, 2026-07-24): cosyte never uses the em dash.
# The em dash (U+2014) reads as an AI tell, so it is banned outright across
# every cosyte surface. Source of truth: `knowledgebase/06-brand/voice-and-tone.md`,
# which names commit messages explicitly.
#
# Ported into synth from the sibling `astm` copy, which is the reference form
# (it carries the interposed-grep fix and the scanner-visibility probe that the
# older `hl7` copy lacks). Like astm, this gate did NOT arrive on a clean tree:
# the same change swept 1,167 occurrences out of 135 of the 223 tracked files,
# including `package.json`'s published npm `description` and fourteen
# `docs-content/` pages that publish to docs.cosyte.com (fourteen: `docs-content/`
# holds fifteen tracked entries and `sidebars.json` is the sidebar config, not a
# page; the doc-id list inside it is what grounds the count). A sweep without the gate
# grows back; a gate without the sweep would have red-flagged CI on arrival. Both
# are one change.
#
# The fix is never to re-encode the character: rewrite the sentence with a
# period, a colon, a comma, or parentheses.
#
# Two modes:
#   check-no-emdash.sh                 scan every tracked file
#   check-no-emdash.sh --stdin LABEL   scan text on stdin (CI feeds it the PR
#                                      title, body, and commit messages: the
#                                      voice rule names commit messages, and this
#                                      repo squash-merges, so the PR title and body
#                                      ARE the message that lands on main)
#
# THREE THINGS DIVERGE FROM THE astm COPY, ALL FORCED BY THIS REPO'S OWN TREE.
# They are written out at the point of use below; in summary:
#
#   (A) THIS REPO TRACKS BINARIES AND astm DOES NOT. Seven vendored `.tgz`
#       tarballs, and one of them really does hold the em dash's UTF-8 bytes by
#       coincidence, so astm's scan-everything form would red here with NO
#       possible remediation. You cannot rewrite a DEFLATE stream with a period.
#   (B) THE PARTITION IS A DECLARATION, NOT A NUL TEST, and on this repo that is
#       not a preference: `test/property/seed-sweep.fuzz.property.test.ts` is a
#       genuine UTF-8 TypeScript source carrying a NUL byte, and it held 14 em
#       dashes on the base commit of the sweep this gate shipped with. A
#       NUL-partitioning scan would have skipped all 14 in silence.
#   (C) `CHANGELOG.md` IS SCANNED ONLY ABOVE ITS ARCHIVE BOUNDARY, because the
#       text below that boundary is a dated ship-log this repo does not edit.
#
# Note: this script itself is excluded from the tracked-file scan (it necessarily
# names the encodings it bans). It matches by codepoint and by encoding, so it
# never contains the literal character.
set -euo pipefail

# ---------------------------------------------------------------------------
# NEUTRALISE AN INTERPOSED `grep`. Carried verbatim from astm; do not weaken it.
# ---------------------------------------------------------------------------
#
# The development container this gate was written in ships a shell FUNCTION named
# `grep` that execs `ugrep` with `-G --ignore-files --hidden -I` forced on. Two of
# those forced flags would each, on their own, turn this file into the exact defect
# it exists to close:
#
#   * `-I` SKIPS ANY FILE THE TOOL CALLS BINARY, SILENTLY, AT EXIT 0. GNU grep
#     instead reports "binary file matches" on stderr, which refuse_if_incomplete
#     below escalates to a hard red. A tool that skips the file prints nothing,
#     exits 0, and this gate reports OK over a live violation it never opened.
#   * `-G` FORCES BASIC REGULAR EXPRESSIONS, under which the `|` alternation in
#     PATTERN is a LITERAL. The pattern would silently match nothing, which is
#     indistinguishable from a clean tree.
#
# A shell function is not exported to a child process, so `bash scripts/check-no-emdash.sh`
# gets the real binary and CI is unaffected. But `export -f grep` in a caller's
# environment WOULD reach here, so the function is unset rather than assumed absent.
# `unset -f` on a name that is not a function is a no-op, so this costs nothing.
#
# This mirrors `scripts/check-no-internal-refs.sh`, this repo's other scanner.
unset -f grep xargs sed awk 2>/dev/null || true

# LOCALE PIN, load-bearing. `grep -P` compiles `\x{NNNN}` as a Unicode codepoint only
# in PCRE's UTF-8 mode, which GNU grep enables from the locale. Under LC_CTYPE=POSIX
# (a bare container, cron, `sh -c`, any shell that inherits no locale) GNU grep 3.8
# instead ABORTS with "character code point value in \x{} or \o{} is too large".
#
# The pin cannot be traded for a raw-byte pattern: `\xe2\x80\x94` matches the em dash
# under POSIX but NOT under a UTF-8 locale, where PCRE reads it as three characters.
# One pattern cannot cover both, so the locale is fixed and the pattern follows it.
export LC_ALL=C.UTF-8

# Matches U+2014 as the literal character and as its encodings: %E2%80%94 (URL), both
# JavaScript backslash-u escapes (the bare and the braced form), and the &mdash; / &#8212; /
# &#x2014; HTML entities, each with or without its closing semicolon.
#
# THE ENTITY ARMS ARE NOT DECORATION. The reference sweep of this rule in
# `claude-containers` found the gate caught what the hand sweep missed precisely
# because a `package.json` held `&mdash;` rather than the literal character. Measured
# on this tree at the time of landing: 1,296 literal occurrences and ZERO entity,
# URL or escape forms, but the arms stay. A sweep that only rewrites the literal
# character is not enough, and the next contributor's editor may not agree with this
# one's.
#
# THE ENCODED ARMS ARE CASE-INSENSITIVE AND TOLERATE LEADING ZEROS, and both halves are
# load-bearing rather than defensive. Lowercase hex is equally valid percent-encoding,
# and `&#X2014;` / `&#08212;` / `&#x02014;` are all valid HTML character references, so
# a case-sensitive zero-intolerant pattern claims coverage it does not have.
#
# THREE ARMS ARE DELIBERATELY OUTSIDE THE CASE-INSENSITIVE GROUP, and the reason is not the
# same for all of them. The literal `\x{2014}` is a codepoint, which has no case. The SOURCE
# ESCAPES `\u2014` and `\u{2014}` do have one and it is significant: no language spells this
# character `\U2014` (JavaScript is `\u2014` or `\u{2014}`, and Python's `\U` requires eight hex
# digits), so a case-insensitive arm there buys zero true positives and reds an ordinary
# Windows path such as `C:\Users\U2014\x`. Measured as a live false positive in the
# sibling before this was split out. Do not "tidy" it back inside the group.
#
# BOTH JAVASCRIPT SPELLINGS ARE COVERED, and only one of them was until a refuter pass on this
# change. The comment above named `\u{2014}` as a JavaScript spelling of this character while the
# pattern matched only `\u2014`, so the file claimed a spelling it did not check and a `.ts` source
# using the braced form would have scanned clean. An overclaim in a gate's own header is the defect
# the header exists to prevent, so the arm was added rather than the sentence deleted.
#
# THE SEMICOLON IS OPTIONAL ON THE THREE ENTITY ARMS, because HTML5 consumes `&mdash`, `&#8212` and
# `&#x2014` without it (the named form is on the legacy no-semicolon list, and the numeric forms are
# terminated by any non-digit). A trailing-semicolon-only pattern therefore misses a real rendered
# em dash. EACH OPTIONAL ARM CARRIES A BOUNDARY rather than a bare `;?`, and the boundary is what
# keeps it honest: `&#8212;?` alone matches inside `&#82120;` and `&#x2014;?` inside `&#x20145;`,
# which are different codepoints entirely, and `&mdash;?` matches inside `&mdashboard`. All three
# were checked as controls alongside the sixteen true spellings.
PATTERN='\x{2014}|\\u2014|\\u\{0*2014\}|(?i:%E2%80%94|&mdash(?:;|(?![A-Za-z0-9]))|&#0*8212(?:;|(?![0-9]))|&#x0*2014(?:;|(?![0-9A-Fa-f])))'

# The literal-only arm, used to scan THIS script (see the self-exclusion note at the
# bottom). This file must be able to name the encoded forms, but it has no reason to
# contain the character itself, so the one arm it can be held to is the codepoint.
LITERAL_PATTERN='\x{2014}'

# SELF-TEST: prove the scanner can still MATCH what it is meant to catch before any
# clean result is believed. `printf` emits U+2014 as its UTF-8 bytes, so this file
# still never contains the literal character.
if ! printf 'a\xe2\x80\x94b\n' | grep -qP "$PATTERN"; then
  echo "ERROR: check-no-emdash - the scanner cannot match a known em dash." >&2
  echo "       grep -P is unavailable or not in UTF-8 mode (LC_ALL=${LC_ALL})." >&2
  echo "       Refusing to report a clean tree on a scanner that cannot see." >&2
  exit 1
fi

fail_with_hits() {
  local what="$1" hits="$2"
  echo "$hits" >&2
  echo "" >&2
  echo "ERROR: check-no-emdash - em dash (U+2014, or an encoded form) found in ${what}." >&2
  echo "       cosyte never uses em dashes (founder directive; 06-brand/voice-and-tone.md)." >&2
  echo "       Rewrite with a period, colon, comma, or parentheses." >&2
  exit 1
}

# Anything the scanner writes to stderr means it did not read everything it was
# given, and an incomplete scan must never print OK. Both modes route grep's stderr
# here and refuse to continue if it is non-empty, because exit status cannot carry
# that signal: grep exits 1 on "no match", which xargs in turn reports as 123, so
# "clean" and "died part way through the batch" are indistinguishable by code.
ERRLOG=$(mktemp)
FILELIST=$(mktemp)
TEXTLIST=$(mktemp)
BINLIST=$(mktemp)
BINPROBE=$(mktemp)
CHANGELOG_HEAD=$(mktemp)
trap 'rm -f "$ERRLOG" "$FILELIST" "$TEXTLIST" "$BINLIST" "$BINPROBE" "$CHANGELOG_HEAD"' EXIT

refuse_if_incomplete() {
  [ -s "$ERRLOG" ] || return 0
  cat "$ERRLOG" >&2
  echo "" >&2
  # GNU grep >= 3.5 prints "grep: FILE: binary file matches" on STDERR with nothing
  # on stdout, so a match in input it cannot read as text arrives here rather than in
  # the hit list. Name that case, or the run reds blaming an I/O failure that never
  # happened and sends a reader hunting it. Both paths exit 1; this only chooses the
  # wording.
  if grep -qi 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-emdash - the input named above MATCHED the em-dash pattern," >&2
    echo "       but grep classifies it as binary, so the hit has no line number. If it" >&2
    echo "       is text, rewrite it. If it is genuinely a binary artifact, it belongs" >&2
    echo "       under vendor/ and declared 'binary' in .gitattributes; do not silence" >&2
    echo "       it here." >&2
  fi
  if grep -qiv 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-emdash - the scan reported errors, so it did not read all of" >&2
    echo "       its input. Refusing to report green from an incomplete scan." >&2
  fi
  exit 1
}

# ---------------------------------------------------------------------------
# THE SCANNER VISIBILITY PROBE.
# ---------------------------------------------------------------------------
#
# The self-test above asserts what the scanner MATCHES. This one asserts what it
# READS, and nothing above can substitute for it: a tool that silently skips a file
# produces the same empty output as a tool that read the file and found it clean.
# Exit status cannot tell them apart either; both are 0.
#
# THIS REPO IS ONE WHERE IT IS NOT THEORETICAL, and the file is named in divergence
# (B) at the top: `test/property/seed-sweep.fuzz.property.test.ts` is a genuine UTF-8
# TypeScript source that embeds a literal NUL in a hostile-bytes fuzz corpus, and it
# carried 14 em dashes on the base commit of the sweep this gate shipped with. On
# this tree an em dash really can live inside input a scanner may classify as binary,
# and a gate that silently skips such input reports OK over live violations.
#
# The property worth pinning is therefore not "grep is GNU" (a version string is easy
# to satisfy and proves nothing about behaviour) but "a violation inside input this
# tool may classify as binary reaches me SOMEHOW": as a hit on stdout, or as a
# diagnostic on stderr. Either is fine. Silence is not.
#
# Assume any grep-based sweep is wrong about NUL until it has proved otherwise. This
# is that proof, and it runs on every invocation rather than once at review time.
printf 'clean line\n\000 seeded \xe2\x80\x94 violation\n' > "$BINPROBE"
PROBE_ERR=$(mktemp)
PROBE_OUT=$(grep -H -nP -e "$PATTERN" -- "$BINPROBE" 2>"$PROBE_ERR" || true)
PROBE_DIAG=$(cat "$PROBE_ERR" 2>/dev/null || true)
rm -f "$PROBE_ERR"
if [ -z "$PROBE_OUT" ] && [ -z "$PROBE_DIAG" ]; then
  echo "ERROR: check-no-emdash - the grep in use SILENTLY SKIPPED a probe file holding a" >&2
  echo "       NUL byte and a seeded em dash: no hit on stdout, no diagnostic on stderr," >&2
  echo "       exit 0. That is a scanner that cannot see its subject, and it is" >&2
  echo "       indistinguishable from a clean tree. The known cause is a \`grep\`" >&2
  echo "       interposed with \`-I\` forced (this container ships one as a shell" >&2
  echo "       function; \`export -f grep\` would reach a child script). Run this gate" >&2
  echo "       with a real GNU grep. Do NOT 'fix' this by deleting the probe: a green" >&2
  echo "       report from a scanner that skips files is the defect this gate prevents," >&2
  echo "       and this repo tracks a NUL-bearing TypeScript file that really does" >&2
  echo "       carry prose." >&2
  exit 1
fi

# ---- stdin mode: text that is not a file (commit messages, PR title and body) ----
if [ "${1:-}" = "--stdin" ]; then
  LABEL="${2:-stdin}"
  HITS=$(grep -nP -e "$PATTERN" - 2>>"$ERRLOG" || true)
  refuse_if_incomplete
  [ -n "$HITS" ] && fail_with_hits "$LABEL" "$HITS"
  echo "check-no-emdash: OK (no em dashes in ${LABEL})"
  exit 0
fi

# ---- default mode: every tracked file ----
#
# `git ls-files` is relative to the working directory, so from a subdirectory it
# lists a subtree and the scan would report OK having skipped the rest of the repo.
# Anchor at the top level, which also keeps the exclusion paths below correct.
cd "$(git rev-parse --show-toplevel)"

# Everything below closes a way for the scan to report green without having looked:
#
#   -0 -r on xargs, fed by a NUL-separated list: -r drops the grep invocation
#   entirely when the list is empty (without it, grep falls back to reading stdin
#   and prints OK), and the NUL separator is what makes the list verbatim.
#   Unseparated, `git ls-files` C-quotes any path holding a space, a quote, or a
#   non-ASCII byte, and grep is then handed a name no file has.
#
#   the file list is built as its own command, not as the head of the pipeline, so a
#   `git ls-files` that fails (an unreadable or corrupt index) stops the run. Piped,
#   its status is erased by the `|| true` the no-match case needs, and the scan would
#   report OK over an empty list. An empty list is refused for the same reason.
#
#   -e before the pattern and -- after the file list, so neither a pattern nor a
#   tracked filename that starts with a dash is read as a grep option. A file named
#   `-q` would otherwise silence the whole batch and the gate would print OK.
#
#   NO -I ANYWHERE. -I skips any file grep reads as binary, in silence, at exit 0.
#   The exclusion below is a DECLARATION instead, so every skip is a line someone
#   wrote down. See the partition block.
#
#   KNOWN LIMIT, unchanged from the sibling copies and restated because this repo
#   generates wire formats. The pattern matches U+2014 as UTF-8 and as the five
#   textual encodings listed with it. It does NOT match an em dash encoded in some
#   other charset (a CP1252 0x97 fixture, a UTF-16 document). Measured, not assumed:
#   such a file scans clean and this gate stays GREEN. There is none today (every
#   tracked text file decodes as UTF-8, checked 2026-08-06). This is accepted rather
#   than fixed: the ban is a rule about prose that people write, and fixture bytes are
#   grounded data, not brand copy. If a legacy-charset fixture ever lands, a reviewer
#   covers it, not this script.
#
#   stderr is captured and any of it fails the run (see refuse_if_incomplete above).
git ls-files -z > "$FILELIST"

if [ ! -s "$FILELIST" ]; then
  echo "ERROR: check-no-emdash - no tracked files to scan. Refusing to report green" >&2
  echo "       from a scan that read nothing." >&2
  exit 1
fi

# A TRACKED FILENAME can itself hold the character, and scanning file CONTENTS never
# looks at one. Cheap to close, so it is closed rather than listed as a known limit.
# This arm covers EVERY tracked path, including the ones excluded from the content
# scan below: a declaration about a file's BYTES says nothing about its NAME.
#
# NO `-o` HERE. With `-z` the "line" grep reports IS the whole NUL-terminated path, which
# is the actionable thing; `-o` would print only the matched character and leave a reader
# with a red gate and no filename.
NAME_HITS=$(grep -zaP -e "$PATTERN" -- "$FILELIST" 2>>"$ERRLOG" | tr '\000' '\n' || true)
refuse_if_incomplete
[ -n "$NAME_HITS" ] && fail_with_hits "a tracked FILENAME (not its contents)" "$NAME_HITS"

# ---------------------------------------------------------------------------
# THE BINARY PARTITION IS A DECLARATION (divergences A and B at the top).
# ---------------------------------------------------------------------------
#
# WHY A PARTITION EXISTS AT ALL, which astm's copy does not need: this repo tracks
# seven vendored `.tgz` tarballs, and `vendor/cosyte-hl7-0.0.0.tgz` contains the
# em dash's UTF-8 bytes (`E2 80 94`) by coincidence inside its DEFLATE stream.
# Measured on this tree. A scan-everything form reds on it forever, because there is
# no edit that removes a byte from a compressed stream without rebuilding someone
# else's package. Same defect `cli` recorded.
#
# WHY IT IS `git check-attr` AND NOT A NUL TEST, which is the half that matters:
# `test/property/seed-sweep.fuzz.property.test.ts` is a real UTF-8 TypeScript source
# holding a literal NUL (a hostile-bytes fuzz corpus), and it carried 14 em dashes
# before this sweep. Partitioning on the NUL byte would have excluded a prose-bearing
# source file in silence and reported green over all 14. Partitioning on grep's `-I`
# heuristic does the same thing and does not even leave a list. A `.gitattributes`
# line is a human declaration: every excluded file is visible, and every red has a
# defined one-line fix.
#
# WHY THE DECLARATION IS ITSELF BOUNDED: a declaration is only as good as its scope,
# and `*.ts binary` in `.gitattributes` would silence this gate over the whole source
# tree with nothing saying so. So the exclusion is refused for any path outside
# `vendor/`. Widening it is then a deliberate edit to THIS file, reviewed, rather
# than a line in a dotfile.
git check-attr --stdin -z binary < "$FILELIST" > "$BINLIST" 2>>"$ERRLOG" || true
refuse_if_incomplete

declare -A DECLARED_BINARY=()
declare -a BINARY_PATHS=()
while IFS= read -r -d '' _path && IFS= read -r -d '' _attr && IFS= read -r -d '' _value; do
  if [ "$_value" = "set" ]; then
    DECLARED_BINARY["$_path"]=1
    BINARY_PATHS+=("$_path")
  fi
done < "$BINLIST"

OUTSIDE=""
for p in ${BINARY_PATHS+"${BINARY_PATHS[@]}"}; do
  case "$p" in vendor/*) ;; *) OUTSIDE="${OUTSIDE}${p}"$'\n' ;; esac
done
if [ -n "$OUTSIDE" ]; then
  printf '%s' "$OUTSIDE" >&2
  echo "" >&2
  echo "ERROR: check-no-emdash - the path(s) above are declared 'binary' in" >&2
  echo "       .gitattributes and are OUTSIDE vendor/, so they would be excluded" >&2
  echo "       from this scan. That exclusion exists for vendored third-party" >&2
  echo "       archives only. A declaration that reaches source or documentation" >&2
  echo "       silences this gate with nothing saying so. Move the file under" >&2
  echo "       vendor/, drop the declaration, or widen the rule in this script" >&2
  echo "       deliberately." >&2
  exit 1
fi
if [ "${#BINARY_PATHS[@]}" -gt 0 ]; then
  echo "check-no-emdash: excluded from the CONTENT scan (declared binary, names still scanned):"
  for p in "${BINARY_PATHS[@]}"; do echo "  $p"; done
fi

# The text list is every tracked file minus the declared binaries, minus this script,
# minus CHANGELOG.md (which gets its own bounded scan two blocks down). Built by
# reading the NUL list rather than by filtering it with another matcher, so a path
# holding a newline or a quote cannot fall out of the filter unnoticed.
: > "$TEXTLIST"
while IFS= read -r -d '' p; do
  case "$p" in
    'scripts/check-no-emdash.sh'|'CHANGELOG.md') continue ;;
  esac
  [ -n "${DECLARED_BINARY[$p]:-}" ] && continue
  printf '%s\0' "$p" >> "$TEXTLIST"
done < "$FILELIST"

if [ ! -s "$TEXTLIST" ]; then
  echo "ERROR: check-no-emdash - the exclusions emptied the file list. Refusing to" >&2
  echo "       report green from a scan that read nothing." >&2
  exit 1
fi

# `-H` forces the filename onto every hit. Without it a batch that xargs happens to run
# with a single operand prints bare `LINE:text`, and the report names no file.
HITS=$(xargs -0 -r grep -d skip -H -nP -e "$PATTERN" -- < "$TEXTLIST" 2>>"$ERRLOG" || true)
refuse_if_incomplete
[ -n "$HITS" ] && fail_with_hits "the tracked files listed above" "$HITS"

# ---------------------------------------------------------------------------
# CHANGELOG.md IS SCANNED ABOVE ITS ARCHIVE BOUNDARY ONLY (divergence C).
# ---------------------------------------------------------------------------
#
# `CHANGELOG.md` is generated output. Since the release started writing it, every
# entry above `## Released before this file was generated` is composed by Changesets
# from a changeset summary, and everything below that heading is the hand-maintained
# history that predates the change: dated ship-log entries that were true when they
# were written.
#
# A DATED RECORD IS CORRECTED ABOVE ITSELF, NEVER EDITED. Rewriting punctuation
# inside a shipped release entry edits the evidence a changelog exists to hold, and
# this repo's own rule is blunter still: do not hand-edit `CHANGELOG.md`. So the
# archive is out of scope, and it is out of scope by a BOUNDARY rather than by
# excluding the file, because the half that is still being written must stay gated:
# a changeset summary becomes a published release body AND a line in the tarball's
# changelog, so an em dash there is a public-surface instance.
#
# The forward control point is `.changeset/*.md`, which the tracked-file scan above
# covers in full. This block is the second net, on what the release actually wrote.
#
# FAIL CLOSED ON A MISSING BOUNDARY. If the heading is gone, the whole file is
# scanned. That reds, loudly, over an archive nobody intended to put back in scope,
# which is the correct direction: the alternative is a silently unbounded exemption.
CHANGELOG_BOUNDARY='## Released before this file was generated'
if [ -f CHANGELOG.md ]; then
  if grep -qxF "$CHANGELOG_BOUNDARY" CHANGELOG.md; then
    awk -v b="$CHANGELOG_BOUNDARY" '$0 == b { exit } { print }' CHANGELOG.md \
      > "$CHANGELOG_HEAD" 2>>"$ERRLOG" || true
    refuse_if_incomplete
    CL_HITS=$(grep -nP -e "$PATTERN" -- "$CHANGELOG_HEAD" 2>>"$ERRLOG" || true)
    refuse_if_incomplete
    [ -n "$CL_HITS" ] && fail_with_hits \
      "the generated part of CHANGELOG.md (above '${CHANGELOG_BOUNDARY}')" "$CL_HITS"
    echo "check-no-emdash: CHANGELOG.md scanned above '${CHANGELOG_BOUNDARY}'"
    echo "  (the hand-maintained archive below it is a dated ship-log and is not edited)"
  else
    CL_HITS=$(grep -nP -e "$PATTERN" -- CHANGELOG.md 2>>"$ERRLOG" || true)
    refuse_if_incomplete
    [ -n "$CL_HITS" ] && fail_with_hits \
      "CHANGELOG.md (its archive boundary heading is missing, so ALL of it is in scope)" "$CL_HITS"
  fi
fi

# THE SELF-EXCLUSION IS NOT A FREE PASS. This file is excluded from the scan above
# because it must spell the encoded forms, but that exclusion was a demonstrated false
# green in the sibling: an em dash appended to the script scanned OK. It has no reason
# to contain the LITERAL character, so it is held to that one arm here. The exclusion
# now costs the script only its ability to name encodings, which is the whole reason it
# exists.
SELF_HITS=$(grep -H -nP -e "$LITERAL_PATTERN" -- 'scripts/check-no-emdash.sh' 2>>"$ERRLOG" || true)
refuse_if_incomplete
[ -n "$SELF_HITS" ] && fail_with_hits "this script itself" "$SELF_HITS"

echo "check-no-emdash: OK (no em dashes in the tracked files, their names, or this script)"

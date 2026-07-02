# Plugin Integration Handoff

> 2026-07-02 16:16 · main — This web tool is interim: the plan is to archive it once its
> CSV-import functionality is integrated into an Obsidian plugin (which plugin: TBD).
> This doc lists what's worth porting and the edge cases that are easy to lose in a rewrite.

All logic lives in [`converter.js`](converter.js) — plain dependency-free JS, no build step.
JSZip is only used for the download; a plugin writes files via the Vault API and won't need it.

## Port these carefully (they encode hard-won edge cases)

### `normalizeDate(val)`
Converts many input formats to `YYYY-MM-DD`, and **passes through unparseable values
as-is rather than corrupting them**. Handles:
- Already-correct `YYYY-MM-DD` / `YYYY-MM-DDThh:mm(:ss)` (left untouched)
- US `M/D/YYYY` (Excel default)
- European `D-M-YYYY` and `D.M.YYYY`
- Written months: `January 5, 2024`, `5 January 2024`, `Jan 5 2024`
- **Excel serial numbers** (integers 1–60000, epoch Dec 30 1899, computed in UTC to
  dodge DST off-by-one-day errors)

### Duplicate-filename suffixing (in the generate handler)
Uses a `usedNames` Set and probes `base-2`, `base-3`, … until free. The naive
`seen[base]++` approach has a real collision bug: rows named `Alpha`, `Alpha`, `Alpha-2`
would produce two files called `Alpha-2` (one overwrites the other). The Set-probe
version was verified against exactly that case. In a plugin, check against existing
vault files too, not just the current batch.

### `sanitizeFilename(str)`
Strips `\ / : * ? " < > |`, falls back to `untitled`. A plugin may want the
windows-friendly-filenames treatment instead, but keep the empty-string fallback.

## Port these as-is (small but deliberate)

- **`toPropertyName(header)`** — Title Case with spaces (`account-holder-name` →
  `Account Holder Name`). Splits on `-`/`_`/camelCase, preserves existing caps (`USD` stays
  `USD`). Note: spaced names need `note["Account Holder Name"]` syntax in Bases formulas —
  that trade-off was chosen consciously (display quality over formula ergonomics).
- **`guessType(header, samples)`** — header-keyword heuristics first (date/time → date,
  amount/balance/total/num → number, link/url → link), then all-numeric sample sniffing.
- **`formatValue(val, type)`** — YAML formatting per type. Non-numeric value in a number
  column falls back to quoted string (never emits invalid YAML). Booleans: `true`/`1`/`yes` →
  true, everything else false. **List cells split on `;` and `,`**, empty list → `[]`.
- **CSV parser** — delimiter auto-detect (tab vs comma by count on first line), quoted
  fields with `""` escapes. No multi-line-quoted-field support — see gaps below.

## UX decisions worth keeping in the plugin

- Include/exclude checkbox per column + select-all with indeterminate state; excluded
  columns vanish from preview and export; 0 included → export blocked with a message.
- **Filename column works even when excluded as a property** (name files by a column
  without duplicating it into frontmatter).
- "Omit empty values" option: blank cell → property left out of that note entirely.
- Preview with prev/next row navigation, not just row 1.
- Column config survives data-row edits — only rebuild the mapping UI when the
  *header row* changes (`lastHeaderKey` comparison). Rebuilding on every keystroke
  wipes the user's renames/types.
- Sample value shown under each original column name (makes type choices obvious).

## Known gaps in the current code (fix or accept during port)

- CSV parser doesn't handle **newlines inside quoted fields** (rare in exports, but real).
- TSV path does no quote handling at all.
- Date parsing assumes US order for `M/D/YYYY` — ambiguous dates like `3/4/2024` are
  silently read as March 4. A plugin could surface an ambiguity warning.
- `list` splitting on `,`/`;` is not configurable; a name like `Doe, Jane` in a list-typed
  column splits wrongly.
- No option yet for a note **body** below the frontmatter (template with `{{column}}`
  placeholders would be the obvious plugin feature).
- Writes into a flat folder; a plugin should offer a target-folder picker and a
  collision policy (skip / overwrite / suffix) against existing vault notes.

## Open questions

- 2026-07-02 16:16 main — Which plugin does this fold into? (Stashpad? A new importer?)
- 2026-07-02 16:16 main — On import collisions with existing vault notes: merge
  frontmatter into the existing note, or always create a suffixed new note?

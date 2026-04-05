# 🗂️ Obsidian Note Generator

A lightweight, offline-capable browser tool that converts CSV or TSV spreadsheet data into Obsidian-ready `.md` files with YAML frontmatter — one file per row, downloaded as a ZIP.

No install. No account. No internet required once saved locally. Open the HTML file and go.

---

## Screenshots

### 1. CSV Input — paste or drop your file
![Screenshot: CSV input area with drag-and-drop zone and paste textarea](screenshots/01-csv-input.png)

### 2. Column Configuration — rename properties, set types, pick the filename column
![Screenshot: Column mapping table showing property name fields, type dropdowns, and filename radio buttons](screenshots/02-column-config.png)

### 3. Live Preview — see the exact YAML frontmatter before generating
![Screenshot: Preview box showing color-coded YAML frontmatter for the first row](screenshots/03-preview.png)

### 4. Output — a ZIP of .md files ready to drop into your vault
![Screenshot: File explorer showing the unzipped .md files](screenshots/04-output-files.png)

---

## Features

- **Drag-and-drop or paste** CSV/TSV directly — no file picker required
- **Auto-detects delimiter** — comma or tab, whichever your export uses
- **Per-column property naming** — rename any column to a valid Obsidian property key
- **Per-column data types** — choose from `text`, `number`, `date`, `boolean`, `list`, or `link`, each formatted correctly in YAML
- **Smart date normalization** — converts `MM/DD/YYYY`, `D-M-YYYY`, written month names, and Excel serial numbers to `YYYY-MM-DD` automatically
- **Filename column selector** — pick any column as the basis for each `.md` file's name
- **Live preview** — color-coded YAML frontmatter updates instantly as you configure
- **Duplicate filename handling** — automatically suffixes conflicting names so nothing gets overwritten
- **Quoted-field CSV support** — values containing commas are handled correctly
- **Fully offline** — works without an internet connection once `jszip.min.js` is saved locally

---

## File Structure

Keep these three files in the same folder:

```
obsidian-note-generator/
├── obsidian-note-generator.html   ← open this in your browser
├── styles.css                     ← stylesheet
└── jszip.min.js                   ← bundled locally for offline use
```

To go fully offline, also remove the Google Fonts `@import` line at the top of `styles.css`. The fallback fonts are `monospace` and `sans-serif` (Courier New / Arial on Windows, Menlo / Helvetica on Mac).

---

## Usage

**1. Open** `obsidian-note-generator.html` in any modern browser.

**2. Load your data** — either drag your `.csv` or `.tsv` file onto the drop zone, or paste the raw CSV text directly.

**3. Configure columns** — for each column detected from your header row:
   - Edit the **property name** (auto-slugified from your header)
   - Set the **data type** using the dropdown
   - Click the **●** radio to choose which column names each `.md` file

**4. Check the preview** — the first row renders as live YAML so you can catch any issues before generating.

**5. Click Download** — a `obsidian-notes.zip` file downloads containing one `.md` file per row.

**6. Unzip into your vault** — drop the files into the relevant folder in Obsidian.

---

## Data Types

| Type | YAML output | Notes |
|---|---|---|
| `text` | `property: "value"` | Default. Handles commas and special characters safely. |
| `number` | `property: 1234` | Unquoted. Falls back to quoted text if the value isn't numeric. |
| `date` | `property: 2024-03-15` | Normalizes multiple input formats to `YYYY-MM-DD`. |
| `boolean` | `property: true` | Recognizes `true`, `yes`, `1` as true; everything else is `false`. |
| `list` | `property:`<br>&nbsp;&nbsp;`- "value"` | Multi-value list. Each CSV cell becomes a single-item list. |
| `link` | `property: "[[value]]"` | Wraps the value in Obsidian internal link syntax. |

---

## Date Normalization

When a column is set to `date`, the tool attempts to parse and reformat to `YYYY-MM-DD`:

| Input format | Example | Output |
|---|---|---|
| Already correct | `2024-03-15` | `2024-03-15` |
| US (Excel default) | `3/15/2024` | `2024-03-15` |
| European | `15-3-2024` or `15.3.2024` | `2024-03-15` |
| Written month | `March 15, 2024` | `2024-03-15` |
| Short month | `Mar 15 2024` | `2024-03-15` |
| Excel serial | `45366` | `2024-03-15` |

If the value can't be parsed, it's passed through as-is rather than corrupted.

---

## Tips

- **Commas in values** — export from Excel normally; Excel automatically wraps fields containing commas in quotes, which the parser handles correctly. Alternatively, export as Tab Delimited (`.txt`) to avoid the issue entirely.
- **Account numbers as numbers** — set the column type to `number` so Obsidian treats them as numeric properties. Make sure the values contain no letters or symbols.
- **Internal links** — use the `link` type to wrap values in `[[...]]`. If you need multiple links in one property, use `list` type and manually format values as `[[Note Name]]` in your source data.
- **Property names** — keep them lowercase with hyphens (e.g. `account-holder-name`). The tool slugifies automatically, but names with spaces or special characters will need bracket syntax in Obsidian Bases formulas: `note["Property Name"]`.

---

## Offline Setup

1. Download `jszip.min.js` from:
   ```
   https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
   ```
2. Place it in the same folder as the HTML file.
3. In `obsidian-note-generator.html`, change:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
   ```
   to:
   ```html
   <script src="jszip.min.js"></script>
   ```
4. Optionally remove the `@import` line at the top of `styles.css` to drop the Google Fonts dependency too.

---

## Example CSV

See [`sample-accounts.csv`](sample-accounts.csv) for a ready-to-use test file.

---

## Requirements

- Any modern browser (Chrome, Firefox, Edge, Safari)
- No server, no backend, no install

## Caveats & Disclaimers
- Not all property types are supported by this tool. For more types, review see the [Property Types documention on Obisidian's published Help Vault].
- I am not a programmer / software engineer/ coder, etc.

## Credits

- **[Claude](https://claude.ai) by Anthropic** — designed and built entirely through conversation, including the HTML, CSS, JavaScript, date parsing, and this README
- **[Google Fonts](https://fonts.google.com)** — IBM Plex Mono and IBM Plex Sans, served free for open use
- **[JSZip](https://stuk.github.io/jszip/)** by Stuart Knightley — ZIP file generation in the browser, hosted via **[Cloudflare cdnjs](https://cdnjs.com)**

### Built Circa
2026.04.03-04
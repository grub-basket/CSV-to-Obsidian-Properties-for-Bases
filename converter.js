let parsedRows = [];
let headers = [];
let lastHeaderKey = '';   // used to keep column config when only data rows change
let previewRowIdx = 0;

const csvText    = document.getElementById('csvText');
const fileInput  = document.getElementById('fileInput');
const dropzone   = document.getElementById('dropzone');
const mappingCard = document.getElementById('mappingCard');
const mappingBody = document.getElementById('mappingBody');
const previewCard = document.getElementById('previewCard');
const preview    = document.getElementById('preview');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const generateBtn = document.getElementById('generate');
const includeAll = document.getElementById('includeAll');
const omitEmpty  = document.getElementById('omitEmpty');
const prevRowBtn = document.getElementById('prevRow');
const nextRowBtn = document.getElementById('nextRow');
const rowIndicator = document.getElementById('rowIndicator');
const loadSampleBtn = document.getElementById('loadSample');

const TYPES = ['text', 'number', 'date', 'boolean', 'list', 'link'];

const SAMPLE_CSV = `account-number,account-holder-name,bank-name,description,date-opened,balance
10042,Jane Doe,Chase,Primary personal checking,3/12/2019,4823.5
10043,Jane Doe,Chase,Joint savings with partner,3/12/2019,12400
10091,Robert Martinez,Wells Fargo,Business operating account,7/1/2021,31750.75
10092,Robert Martinez,Wells Fargo,Business reserve fund,7/1/2021,9000
10105,Priya Nair,Bank of America,Personal checking,11/5/2020,2250
10106,Priya Nair,Bank of America,High-yield savings,11/5/2020,18600
10134,David Chen,Citibank,Checking - direct deposit,2/28/2018,5410.2
10201,Sandra Okafor,US Bank,Personal checking,9/14/2022,780
10202,Sandra Okafor,US Bank,Emergency fund savings,9/14/2022,6500
10250,Tom Nguyen,Chase,Freelance income account,1/3/2023,11230.9`;

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
});

fileInput.addEventListener('change', () => { if (fileInput.files[0]) readFile(fileInput.files[0]); });

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => { csvText.value = e.target.result; processCSV(); };
  reader.readAsText(file);
}

csvText.addEventListener('input', processCSV);

if (loadSampleBtn) loadSampleBtn.addEventListener('click', () => {
  csvText.value = SAMPLE_CSV;
  processCSV();
});

function parseCSV(text) {
  const firstLine = text.split(/\r?\n/)[0];
  const delim = (firstLine.match(/\t/g)||[]).length > (firstLine.match(/,/g)||[]).length ? '\t' : ',';
  const lines = text.trim().split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    if (delim === '\t') {
      result.push(line.split('\t').map(v => v.trim()));
    } else {
      const row = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          row.push(cur.trim()); cur = '';
        } else { cur += ch; }
      }
      row.push(cur.trim());
      result.push(row);
    }
  }
  return result;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// "account-holder-name" / "account_holder_name" / "accountHolderName" → "Account Holder Name"
function toPropertyName(str) {
  return str
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Column';
}

function guessType(header, samples) {
  const h = header.toLowerCase();
  if (h.includes('date') || h.includes('time')) return 'date';
  if (h.includes('amount') || h.includes('balance') || h.includes('total') || h.includes('number') || h.includes('num') || h.includes('acct') || h.includes('account-number')) return 'number';
  if (h.includes('link') || h.includes('url')) return 'link';
  const nonEmpty = samples.filter(v => v !== '');
  if (nonEmpty.length && nonEmpty.every(v => !isNaN(v) && v !== '')) return 'number';
  return 'text';
}

function processCSV() {
  const text = csvText.value.trim();
  if (!text) {
    setStatus('', 'Waiting for CSV input…');
    mappingCard.style.display = 'none';
    previewCard.style.display = 'none';
    generateBtn.disabled = true;
    lastHeaderKey = '';
    return;
  }
  try {
    const rows = parseCSV(text);
    if (rows.length < 2) { setStatus('error', 'Need at least a header row and one data row.'); generateBtn.disabled = true; return; }
    headers = rows[0];
    parsedRows = rows.slice(1).filter(r => r.some(c => c !== ''));
    if (!parsedRows.length) {
      setStatus('error', 'Need at least a header row and one data row.');
      generateBtn.disabled = true;
      mappingCard.style.display = 'none';
      previewCard.style.display = 'none';
      return;
    }
    previewRowIdx = Math.min(previewRowIdx, Math.max(0, parsedRows.length - 1));
    // Only rebuild the column config when the headers change, so edits to
    // data rows don't wipe the user's property names / types / selections.
    const headerKey = JSON.stringify(headers);
    if (headerKey !== lastHeaderKey) {
      buildMappingUI();
      lastHeaderKey = headerKey;
      previewRowIdx = 0;
    }
    refreshState();
    mappingCard.style.display = 'block';
    previewCard.style.display = 'block';
  } catch(e) {
    setStatus('error', 'Could not parse CSV. Check formatting.');
    generateBtn.disabled = true;
  }
}

function buildMappingUI() {
  mappingBody.innerHTML = '';
  headers.forEach((h, i) => {
    const samples = parsedRows.slice(0, 5).map(r => r[i] || '');
    const guessed = guessType(h, samples);
    const sample = samples.find(v => v !== '') || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="check-col">
        <input type="checkbox" class="include-check" id="include_${i}" checked title="Include this column in the export">
      </td>
      <td>
        <div class="col-original" title="${esc(h)}">${esc(h)}</div>
        <div class="col-sample" title="${esc(sample)}">${esc(sample)}</div>
      </td>
      <td><input type="text" id="propname_${i}" value="${esc(toPropertyName(h))}" placeholder="Property Name"></td>
      <td>
        <select id="proptype_${i}" class="type-${guessed}">
          ${TYPES.map(t => `<option value="${t}"${t===guessed?' selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td class="radio-col">
        <input type="radio" name="filenameCol" value="${i}"${i===0?' checked':''} title="Use this column as the filename">
      </td>
    `;
    mappingBody.appendChild(tr);
    const sel = tr.querySelector(`#proptype_${i}`);
    sel.addEventListener('change', () => { sel.className = `type-${sel.value}`; refreshState(); });
  });
  mappingBody.querySelectorAll('input').forEach(el => {
    el.addEventListener('change', refreshState);
    el.addEventListener('input', refreshState);
  });
  if (includeAll) includeAll.checked = true;
}

if (includeAll) includeAll.addEventListener('change', () => {
  mappingBody.querySelectorAll('.include-check').forEach(cb => { cb.checked = includeAll.checked; });
  refreshState();
});

if (omitEmpty) omitEmpty.addEventListener('change', refreshState);

if (prevRowBtn) prevRowBtn.addEventListener('click', () => { previewRowIdx = Math.max(0, previewRowIdx - 1); refreshState(); });
if (nextRowBtn) nextRowBtn.addEventListener('click', () => { previewRowIdx = Math.min(parsedRows.length - 1, previewRowIdx + 1); refreshState(); });

function getColConfig() {
  return headers.map((h, i) => ({
    propName: (document.getElementById(`propname_${i}`)?.value.trim()) || toPropertyName(h),
    type: document.getElementById(`proptype_${i}`)?.value || 'text',
    include: document.getElementById(`include_${i}`)?.checked !== false,
  }));
}

function getFilenameColIdx() {
  return parseInt(document.querySelector('input[name="filenameCol"]:checked')?.value || '0');
}

// Refresh master checkbox, preview, status, and button state after any config change
function refreshState() {
  if (!parsedRows.length) return;
  const config = getColConfig();
  const includedCount = config.filter(c => c.include).length;

  if (includeAll) {
    includeAll.checked = includedCount === config.length;
    includeAll.indeterminate = includedCount > 0 && includedCount < config.length;
  }

  updatePreview();

  if (includedCount === 0) {
    setStatus('error', 'No columns included — tick at least one column to export.');
    generateBtn.disabled = true;
  } else {
    const excluded = config.length - includedCount;
    setStatus('ready', `${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''} · ${includedCount} of ${config.length} column${config.length !== 1 ? 's' : ''} included${excluded ? ` (${excluded} excluded)` : ''} — ready to generate`);
    generateBtn.disabled = false;
  }
}

function normalizeDate(val) {
  if (!val) return val;
  val = val.trim();

  // Already correct: YYYY-MM-DD or YYYY-MM-DDThh:mm:ss
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(val)) return val;

  let d = null;

  // M/D/YYYY or MM/DD/YYYY (US, Excel default)
  let m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) d = new Date(+m[3], +m[1]-1, +m[2]);

  // D-M-YYYY or D.M.YYYY
  if (!d) { m = val.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/); if (m) d = new Date(+m[3], +m[2]-1, +m[1]); }

  // Month name: "January 5, 2024" or "5 January 2024" or "Jan 5 2024"
  if (!d) {
    const months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,
                    jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    m = val.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m && months[m[1].toLowerCase()] !== undefined) d = new Date(+m[3], months[m[1].toLowerCase()], +m[2]);
    if (!d) { m = val.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/); if (m && months[m[2].toLowerCase()] !== undefined) d = new Date(+m[3], months[m[2].toLowerCase()], +m[1]); }
  }

  // Excel serial number (integer between 1 and 60000)
  if (!d && /^\d+$/.test(val)) {
    const n = parseInt(val);
    if (n > 1 && n < 60000) {
      // Excel epoch: Dec 30 1899
      d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    }
  }

  if (d && !isNaN(d)) {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth()+1).padStart(2,'0');
    const dd   = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: return as-is
  return val;
}

function formatValue(val, type) {
  val = val || '';
  switch(type) {
    case 'number':  return (val !== '' && !isNaN(val)) ? val : `"${val.replace(/"/g,'\\"')}"`;
    case 'boolean': return (['true','1','yes'].includes(val.toLowerCase())) ? 'true' : 'false';
    case 'date':    return normalizeDate(val);
    case 'list': {
      // Split on semicolons or commas so one cell can hold multiple items
      const items = val.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      if (!items.length) return ' []';
      return items.map(it => `\n  - "${it.replace(/"/g,'\\"')}"`).join('');
    }
    case 'link':    return `"[[${val.replace(/"/g,'\\"')}]]"`;
    default:        return `"${val.replace(/"/g,'\\"')}"`;
  }
}

function rowToFrontmatter(row) {
  const config = getColConfig();
  const skipEmpty = omitEmpty?.checked;
  let yaml = '---\n';
  config.forEach((col, i) => {
    if (!col.include) return;
    const raw = (row[i] || '').trim();
    if (skipEmpty && raw === '') return;
    yaml += `${col.propName}: ${formatValue(raw, col.type)}\n`;
  });
  yaml += '---\n';
  return yaml;
}

function updatePreview() {
  if (!parsedRows.length) return;
  const row = parsedRows[previewRowIdx];
  const config = getColConfig();
  const skipEmpty = omitEmpty?.checked;
  const fnIdx = getFilenameColIdx();
  const filename = sanitizeFilename(row[fnIdx] || `note-${previewRowIdx+1}`);

  let html = `<span class="filename-hint"># ${esc(filename)}.md</span>\n`;
  html += '<span class="yaml-fence">---</span>\n';
  config.forEach((col, i) => {
    if (!col.include) return;
    const raw = (row[i] || '').trim();
    if (skipEmpty && raw === '') return;
    const formatted = formatValue(raw, col.type);
    html += `<span class="prop-key">${esc(col.propName)}</span>: <span class="type-${col.type}">${esc(formatted)}</span>\n`;
  });
  html += '<span class="yaml-fence">---</span>';
  preview.innerHTML = html;

  if (rowIndicator) rowIndicator.textContent = `Row ${previewRowIdx + 1} of ${parsedRows.length}`;
  if (prevRowBtn) prevRowBtn.disabled = previewRowIdx === 0;
  if (nextRowBtn) nextRowBtn.disabled = previewRowIdx >= parsedRows.length - 1;
}

function sanitizeFilename(str) {
  return str.replace(/[\\/:*?"<>|]/g, '-').trim() || 'untitled';
}

generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ Generating…';
  const zip = new JSZip();
  const fnIdx = getFilenameColIdx();
  const usedNames = new Set();
  parsedRows.forEach((row, idx) => {
    const base = sanitizeFilename(row[fnIdx] || `note-${idx+1}`);
    let name = base, n = 2;
    while (usedNames.has(name)) { name = `${base}-${n++}`; }
    usedNames.add(name);
    zip.file(`${name}.md`, rowToFrontmatter(row));
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'obsidian-notes.zip';
  a.click();
  generateBtn.disabled = false;
  generateBtn.textContent = '⬇ Download ZIP of .md Files';
  setStatus('ready', `✓ ${parsedRows.length} notes exported`);
});

function setStatus(type, msg) {
  statusDot.className = 'status-dot' + (type ? ` ${type}` : '');
  statusText.textContent = msg;
}

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

document.addEventListener('dragenter', () => {
  document.getElementById('dropzone').classList.add('drag-over');
});

document.addEventListener('dragleave', e => {
  if (e.relatedTarget === null) {
    document.getElementById('dropzone').classList.remove('drag-over');
  }
});

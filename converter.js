let parsedRows = [];
let headers = [];

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

const TYPES = ['text', 'number', 'date', 'boolean', 'list', 'link'];

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

function toPropertyKey(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
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
    return;
  }
  try {
    const rows = parseCSV(text);
    if (rows.length < 2) { setStatus('error', 'Need at least a header row and one data row.'); generateBtn.disabled = true; return; }
    headers = rows[0];
    parsedRows = rows.slice(1).filter(r => r.some(c => c !== ''));
    buildMappingUI();
    updatePreview();
    setStatus('ready', `${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''} detected — ready to generate`);
    generateBtn.disabled = false;
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="col-original" title="${h}">${h}</div></td>
      <td><input type="text" id="propname_${i}" value="${toPropertyKey(h)}" placeholder="property-name"></td>
      <td>
        <select id="proptype_${i}" class="type-${guessed}">
          ${TYPES.map(t => `<option value="${t}"${t===guessed?' selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td class="radio-col">
        <input type="radio" name="filenameCol" value="${i}"${i===0?' checked':''}>
      </td>
    `;
    mappingBody.appendChild(tr);
    const sel = tr.querySelector(`#proptype_${i}`);
    sel.addEventListener('change', () => { sel.className = `type-${sel.value}`; updatePreview(); });
  });
  mappingBody.querySelectorAll('input').forEach(el => {
    el.addEventListener('change', updatePreview);
    el.addEventListener('input', updatePreview);
  });
}

function getColConfig() {
  return headers.map((h, i) => ({
    propName: (document.getElementById(`propname_${i}`)?.value.trim()) || toPropertyKey(h),
    type: document.getElementById(`proptype_${i}`)?.value || 'text',
  }));
}

function getFilenameColIdx() {
  return parseInt(document.querySelector('input[name="filenameCol"]:checked')?.value || '0');
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
    case 'list':    return `\n  - "${val.replace(/"/g,'\\"')}"`;
    case 'link':    return `"[[${val.replace(/"/g,'\\"')}]]"`;
    default:        return `"${val.replace(/"/g,'\\"')}"`;
  }
}

function rowToFrontmatter(row) {
  const config = getColConfig();
  let yaml = '---\n';
  config.forEach((col, i) => {
    yaml += `${col.propName}: ${formatValue(row[i]||'', col.type)}\n`;
  });
  yaml += '---\n';
  return yaml;
}

function updatePreview() {
  if (!parsedRows.length) return;
  const row = parsedRows[0];
  const config = getColConfig();
  const fnIdx = getFilenameColIdx();
  const filename = sanitizeFilename(row[fnIdx] || 'note-1');

  let html = `<span class="filename-hint"># ${filename}.md</span>\n`;
  html += '<span class="yaml-fence">---</span>\n';
  config.forEach((col, i) => {
    const formatted = formatValue(row[i]||'', col.type);
    html += `<span class="prop-key">${col.propName}</span>: <span class="type-${col.type}">${formatted}</span>\n`;
  });
  html += '<span class="yaml-fence">---</span>';
  preview.innerHTML = html;
}

function sanitizeFilename(str) {
  return str.replace(/[\\/:*?"<>|]/g, '-').trim() || 'untitled';
}

generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ Generating…';
  const zip = new JSZip();
  const fnIdx = getFilenameColIdx();
  const seen = {};
  parsedRows.forEach((row, idx) => {
    let base = sanitizeFilename(row[fnIdx] || `note-${idx+1}`);
    if (seen[base]) { seen[base]++; base = `${base}-${seen[base]}`; }
    else seen[base] = 1;
    zip.file(`${base}.md`, rowToFrontmatter(row));
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
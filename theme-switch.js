const themes = {
  light: { file: 'styles-light.css', next: 'dark',  label: '🌙 Dark'  },
  dark:  { file: 'styles-dark.css',  next: 'light', label: '☀️ Light' },
};

// Load saved preference, fall back to the OS color scheme
const osPref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let current = localStorage.getItem('theme') || osPref;
applyTheme(current);

function toggleTheme() {
  current = themes[current].next;
  applyTheme(current);
  localStorage.setItem('theme', current);
}

function applyTheme(name) {
  document.getElementById('theme-stylesheet').href = themes[name].file;
  document.getElementById('theme-toggle').textContent = themes[name].label;
}
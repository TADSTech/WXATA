const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Dashboard.tsx',
  'src/pages/Marketplace.tsx',
  'src/pages/Admin.tsx',
  'src/pages/Landing.tsx'
];

const replacements = [
  // Backgrounds
  { pattern: /bg-\[#050505\]/g, replacement: 'bg-bg-base' },
  { pattern: /bg-slate-900/g, replacement: 'bg-bg-panel' },
  { pattern: /bg-gray-900\/50/g, replacement: 'bg-bg-panel' },
  { pattern: /bg-gray-900/g, replacement: 'bg-bg-panel' },
  { pattern: /bg-black/g, replacement: 'bg-bg-base' },
  { pattern: /bg-\[#0a0a0a\]/g, replacement: 'bg-bg-panel' },
  { pattern: /bg-black\/80/g, replacement: 'bg-bg-base/80' },
  
  // Accents / Buttons
  { pattern: /bg-blue-600/g, replacement: 'bg-accent-primary' },
  { pattern: /hover:bg-blue-500/g, replacement: 'hover:bg-accent-hover' },
  { pattern: /bg-blue-500/g, replacement: 'bg-accent-primary' },
  { pattern: /bg-blue-900\/30/g, replacement: 'bg-accent-subtle' },
  { pattern: /hover:bg-blue-800\/50/g, replacement: 'hover:bg-accent-subtle' },
  { pattern: /bg-emerald-500\/10/g, replacement: 'bg-accent-subtle' },
  { pattern: /bg-emerald-900\/20/g, replacement: 'bg-accent-subtle' },
  { pattern: /hover:bg-emerald-500\/10/g, replacement: 'hover:bg-accent-subtle' },
  { pattern: /bg-emerald-500\/20/g, replacement: 'bg-accent-subtle' },
  
  // Text
  { pattern: /text-emerald-400/g, replacement: 'text-accent-light' },
  { pattern: /text-emerald-500/g, replacement: 'text-accent-primary' },
  { pattern: /text-emerald-300/g, replacement: 'text-accent-light' },
  { pattern: /text-emerald-700/g, replacement: 'text-accent-primary' },
  { pattern: /text-blue-500/g, replacement: 'text-accent-primary' },
  { pattern: /text-blue-400/g, replacement: 'text-accent-light' },
  { pattern: /text-blue-300/g, replacement: 'text-accent-light' },
  
  { pattern: /text-slate-400/g, replacement: 'text-text-muted' },
  { pattern: /text-slate-500/g, replacement: 'text-text-muted' },
  { pattern: /text-slate-600/g, replacement: 'text-text-muted' },
  { pattern: /text-slate-700/g, replacement: 'text-text-muted' },
  { pattern: /text-gray-300/g, replacement: 'text-text-muted' },
  { pattern: /text-gray-400/g, replacement: 'text-text-muted' },
  { pattern: /text-gray-500/g, replacement: 'text-text-muted' },
  { pattern: /text-gray-600/g, replacement: 'text-text-muted' },
  
  { pattern: /text-white/g, replacement: 'text-text-main' },
  { pattern: /text-slate-200/g, replacement: 'text-text-main' },
  
  // Borders
  { pattern: /border-emerald-500\/20/g, replacement: 'border-border-subtle' },
  { pattern: /border-emerald-500\/30/g, replacement: 'border-border-strong' },
  { pattern: /border-emerald-500\/50/g, replacement: 'border-border-strong' },
  { pattern: /border-emerald-500/g, replacement: 'border-border-strong' },
  { pattern: /border-blue-500\/20/g, replacement: 'border-border-subtle' },
  { pattern: /border-blue-500\/30/g, replacement: 'border-border-strong' },
  { pattern: /border-blue-500\/50/g, replacement: 'border-border-strong' },
  { pattern: /border-blue-500/g, replacement: 'border-border-strong' },
  { pattern: /border-gray-800/g, replacement: 'border-border-strong' },
  { pattern: /border-gray-700/g, replacement: 'border-border-subtle' },
  
  // Shadows
  { pattern: /shadow-\[0_0_10px_rgba\(34,197,94,0\.1\)\]/g, replacement: 'shadow-[0_0_10px_var(--accent-subtle)]' },
  { pattern: /shadow-\[0_0_15px_rgba\(34,197,94,0\.2\)\]/g, replacement: 'shadow-[0_0_15px_var(--accent-subtle)]' },
  { pattern: /shadow-\[0_0_30px_rgba\(16,185,129,0\.1\)\]/g, replacement: 'shadow-[0_0_30px_var(--accent-subtle)]' },
  { pattern: /shadow-\[0_0_10px_rgba\(59,130,246,0\.3\)\]/g, replacement: 'shadow-[0_0_10px_var(--accent-subtle)]' },
  { pattern: /shadow-\[0_0_20px_rgba\(59,130,246,0\.15\)\]/g, replacement: 'shadow-[0_0_20px_var(--accent-subtle)]' }
];

for (const relPath of files) {
  // Use absolute path relative to where this script is placed (in scratch)
  // But wait, I'll run this script from the frontend directory: `node script.js`
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('Not found:', fullPath);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changes = 0;
  for (const { pattern, replacement } of replacements) {
    const prev = content;
    content = content.replace(pattern, replacement);
    if (content !== prev) changes++;
  }
  
  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${relPath} (${changes} rules applied)`);
}

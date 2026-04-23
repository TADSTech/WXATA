const fs = require('fs');
const path = require('path');

const replacements = [
    // Backgrounds
    { from: /bg-slate-900/g, to: 'bg-bg-base' },
    { from: /bg-slate-950/g, to: 'bg-bg-base' },
    { from: /bg-slate-800/g, to: 'bg-bg-panel' },
    { from: /bg-black/g, to: 'bg-bg-base' },
    { from: /bg-emerald-500\/10/g, to: 'bg-accent-subtle' },
    { from: /bg-emerald-500\/5/g, to: 'bg-accent-subtle' },
    { from: /bg-emerald-600/g, to: 'bg-accent-primary' },
    { from: /bg-emerald-500/g, to: 'bg-accent-hover' },
    { from: /bg-blue-500/g, to: 'bg-accent-primary' },
    { from: /bg-blue-600/g, to: 'bg-accent-hover' },
    { from: /bg-blue-900\/30/g, to: 'bg-accent-subtle' },
    { from: /bg-gray-800/g, to: 'bg-bg-panel-hover' },
    { from: /bg-gray-900/g, to: 'bg-bg-base' },

    // Text
    { from: /text-emerald-400/g, to: 'text-accent-light' },
    { from: /text-emerald-500/g, to: 'text-accent-primary' },
    { from: /text-blue-400/g, to: 'text-accent-light' },
    { from: /text-blue-500/g, to: 'text-accent-primary' },
    { from: /text-slate-400/g, to: 'text-text-muted' },
    { from: /text-slate-500/g, to: 'text-text-muted' },
    { from: /text-white/g, to: 'text-text-main' },
    { from: /text-gray-400/g, to: 'text-text-muted' },
    
    // Borders
    { from: /border-emerald-500\/30/g, to: 'border-border-subtle' },
    { from: /border-emerald-500\/20/g, to: 'border-border-subtle' },
    { from: /border-slate-800/g, to: 'border-border-strong' },
    { from: /border-slate-700/g, to: 'border-border-subtle' },
    { from: /border-blue-500\/30/g, to: 'border-border-subtle' },
    { from: /border-gray-800/g, to: 'border-border-strong' },
    { from: /border-gray-700/g, to: 'border-border-subtle' },
];

const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');
const files = fs.readdirSync(pagesDir);

files.forEach(file => {
    if (file.endsWith('.tsx')) {
        const filePath = path.join(pagesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        replacements.forEach(rep => {
            content = content.replace(rep.from, rep.to);
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            console.log(`Refactored ${file}`);
        }
    }
});

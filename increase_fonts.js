const fs = require('fs');

const p = 'c:\\github_repo\\survey\\app\\admin\\dashboard\\page.tsx';
let content = fs.readFileSync(p, 'utf8');

const replacements = [
    { from: /\btext-3xl\b/g, to: 'text-4xl' },
    { from: /\btext-2xl\b/g, to: 'text-3xl' },
    { from: /\btext-xl\b/g, to: 'text-2xl' },
    { from: /\btext-lg\b/g, to: 'text-xl' },
    { from: /\btext-base\b/g, to: 'text-lg' },
    { from: /\btext-sm\b/g, to: 'text-base' },
    { from: /\btext-xs\b/g, to: 'text-sm' },
    { from: /\btext-\[11px\]\b/g, to: 'text-xs' },
    { from: /fontSize: 16/g, to: 'fontSize: 18' },
    { from: /fontSize: 14/g, to: 'fontSize: 16' },
    { from: /fontSize: 12/g, to: 'fontSize: 14' },
    { from: /fontSize: 11/g, to: 'fontSize: 13' }
];

for (const { from, to } of replacements) {
    content = content.replace(from, to);
}

fs.writeFileSync(p, content, 'utf8');
console.log('Done');

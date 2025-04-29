// Debug script to inspect verse blocks and extraction logic — outputs to file

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const inputPath = path.join(__dirname, 'input', 'sb', 'SB1.1.pdf');
const outputPath = path.join(__dirname, 'debug-output', 'verse_debug_output.txt');

function clean(text) {
    return text.replace(/[\r\n]+/g, '\n').replace(/[\t\u00A0]+/g, ' ').trim();
}

function extractBlocks(text) {
    return text.split(/(?=\n*TEXT(?:S)?\s+\d+(?:\s*[–-]\s*\d+)?)/i).map(b => b.trim()).filter(Boolean);
}

function extractMeta(block, label) {
    const regex = new RegExp(`${label}[\s\n]*([\s\S]*?)(?=\n*(TRANSLATION|PURPORT|TEXT|TEXTS|CHAPTER|$))`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : '';
}

function extractAfter(label, block) {
    const regex = new RegExp(`${label}[\s\n]+([\s\S]+)`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : '';
}

function getVerseRef(block) {
    const match = block.match(/TEXT(?:S)?\s+(\d+(?:\s*[–-]\s*\d+)?)/i);
    return match ? match[1].replace(/[–-]/g, '–') : null;
}

(async () => {
    const ext = path.extname(inputPath).toLowerCase();
    const rawText = clean(ext === '.pdf'
        ? (await pdfParse(fs.readFileSync(inputPath))).text
        : (await mammoth.extractRawText({ path: inputPath })).value);

    const blocks = extractBlocks(rawText);
    const logs = [`🔍 Found ${blocks.length} blocks\n`];

    for (const block of blocks) {
        const verse = getVerseRef(block);
        const sanskrit = extractMeta(block, 'TEXT');
        const translation = extractMeta(block, 'TRANSLATION');
        const purport = extractAfter('PURPORT', block);

        logs.push(`\n🪔 Verse: ${verse || '[NONE]'}`);
        logs.push(`📜 Sanskrit: ${sanskrit ? '[OK]' : '[MISSING]'}`);
        logs.push(`🌐 Translation: ${translation ? '[OK]' : '[MISSING]'}`);
        logs.push(`🧾 Purport: ${purport ? '[YES]' : '[NO]'}`);
        logs.push('-'.repeat(50));
    }

    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, logs.join('\n'), 'utf8');
    console.log(`✅ Output saved to ${outputPath}`);
})();

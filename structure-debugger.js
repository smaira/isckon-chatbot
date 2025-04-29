// Debug script: scans PDF and DOCX files for structural markers, grouped by subfolder with progress

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const inputFolder = path.join(__dirname, 'input');
const outputFolder = path.join(__dirname, 'debug-output');
const markers = ['PREFACE', 'INTRODUCTION', 'CHAPTER', 'TEXT', 'TRANSLATION', 'PURPORT'];

if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

function scanTextLines(text, fileLabel) {
    const lines = text.split(/\n|\r/);
    const found = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const marker of markers) {
            if (trimmed.toUpperCase().startsWith(marker)) {
                found.push(`- [${marker}] ${trimmed}`);
                break;
            }
        }
    }
    return found.length > 0 ? [`\n📄 ${fileLabel}`, ...found] : [];
}

async function processFile(filePath, subfolderName, outputByFolder) {
    const ext = path.extname(filePath).toLowerCase();
    const label = path.relative(inputFolder, filePath);
    try {
        let lines = [];
        if (ext === '.pdf') {
            const data = await pdfParse(fs.readFileSync(filePath));
            lines = scanTextLines(data.text, label);
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            lines = scanTextLines(result.value, label);
        }
        if (lines.length > 0) {
            if (!outputByFolder[subfolderName]) outputByFolder[subfolderName] = [];
            outputByFolder[subfolderName].push(...lines);
        }
    } catch (err) {
        console.error(`❌ Failed to process ${label}:`, err.message);
    }
}

async function run() {
    const outputByFolder = {};
    const subfolders = fs.readdirSync(inputFolder).filter(f => fs.statSync(path.join(inputFolder, f)).isDirectory());
    let totalFiles = 0;
    let processed = 0;

    const allFiles = [];
    for (const sub of subfolders) {
        const subPath = path.join(inputFolder, sub);
        const files = fs.readdirSync(subPath).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));
        files.forEach(file => allFiles.push({ path: path.join(subPath, file), folder: sub }));
    }
    totalFiles = allFiles.length;

    for (const file of allFiles) {
        await processFile(file.path, file.folder, outputByFolder);
        processed++;
        const percent = ((processed / totalFiles) * 100).toFixed(1);
        process.stdout.write(`\r🔍 Processing: ${processed}/${totalFiles} files (${percent}%)`);
    }

    console.log('\n\n📦 Writing outputs...');
    for (const [folder, content] of Object.entries(outputByFolder)) {
        const outPath = path.join(outputFolder, `${folder}.txt`);
        fs.writeFileSync(outPath, content.join('\n'), 'utf8');
        console.log(`✅ Saved: ${outPath}`);
    }
}

run();

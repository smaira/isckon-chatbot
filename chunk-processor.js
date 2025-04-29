// Final Chunk Processor with improved logic and test mode

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');

const inputFolder = path.join(__dirname, 'input');
const outputFolder = path.join(__dirname, 'output');
const testOnly = true; // ✅ Set this to true to process just 1 file per subfolder for fast testing

function clean(text) {
    return text.replace(/[\r\n]+/g, '\n').replace(/[\t\u00A0]+/g, ' ').trim();
}

function extractSections(text) {
    return text.split(/(?=\n*TEXT(?:S)?\s+\d+(?:\s*[–-]\s*\d+)?)/i).map(b => b.trim()).filter(Boolean);
}

function extractMeta(block, label) {
    const regex = new RegExp(`${label}[\s\n]*([\s\S]*?)(?=\\n*(TRANSLATION|PURPORT|TEXT|TEXTS|CHAPTER|$))`, 'i');
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

function isCommentaryBlock(line) {
    return line.length > 40 && !/copyright|bhaktivedanta/i.test(line);
}

function guessTitle(text, fileName) {
    if (/PREFACE/i.test(text)) return 'Preface';
    if (/INTRODUCTION/i.test(text)) return 'Introduction';
    if (/GITA-MAHATMYA/i.test(text)) return 'Gītā-māhātmya';
    const match = text.match(/CHAPTER\s+\d+\s+[–-]\s+(.+)/i);
    return match ? match[1].trim() : path.basename(fileName, '.pdf');
}

// Add this function to process text files
async function processTextFile(filePath, bookTitle, fileIndex, totalFiles) {
    const rawText = clean(fs.readFileSync(filePath, 'utf8'));

    // The rest of your processing logic remains the same
    const chapterTitle = guessTitle(rawText, path.basename(filePath));
    const blocks = extractSections(rawText);
    const chunks = [];
    let purportPart = 1;

    // Your existing logic for processing blocks...

    const outputPath = path.join(outputFolder, path.basename(filePath, '.txt') + '.json');
    fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2));
    console.log(`✅ Processed: ${filePath} (${fileIndex + 1}/${totalFiles}, ${percent}%)`);
}

async function processFile(filePath, bookTitle, fileIndex, totalFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const rawText = clean(ext === '.pdf' ? (await pdfParse(fileBuffer)).text : (await mammoth.extractRawText({ path: filePath })).value);

    const chapterTitle = guessTitle(rawText, baseName);
    const blocks = extractSections(rawText);
    const chunks = [];
    let purportPart = 1;

    if (!blocks.length || (blocks.length === 1 && !/TEXT/i.test(blocks[0]))) {
        rawText.split(/\n\n+/).forEach(p => {
            const para = p.trim();
            if (isCommentaryBlock(para)) {
                chunks.push({
                    id: uuidv4(),
                    book_title: bookTitle,
                    canto_number: null,
                    chapter_number: null,
                    chapter_title: chapterTitle,
                    section: chapterTitle,
                    verse_reference: null,
                    text_type: 'commentary',
                    sanskrit: '',
                    translation: '',
                    content: para,
                    purport_part: purportPart++
                });
            }
        });
    } else {
        for (const block of blocks) {
            const verseRef = getVerseRef(block);
            const sanskrit = extractMeta(block, 'TEXT');
            const translation = extractMeta(block, 'TRANSLATION');
            const purport = extractAfter('PURPORT', block);

            if (!verseRef && !translation && !purport) continue;

            const type = translation ? (purport ? 'verse_commentary' : 'verse_only') : 'commentary';

            chunks.push({
                id: uuidv4(),
                book_title: bookTitle,
                canto_number: null,
                chapter_number: null,
                chapter_title: chapterTitle,
                section: chapterTitle,
                verse_reference: verseRef,
                text_type: type,
                sanskrit: sanskrit.trim(),
                translation: translation.trim(),
                content: purport || '',
                purport_part: purport ? purportPart++ : null
            });
        }
    }

    const outputPath = path.join(outputFolder, path.basename(filePath, ext) + '.json');
    fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2));
    const percent = ((fileIndex + 1) / totalFiles * 100).toFixed(1);
    console.log(`✅ Processed: ${filePath} (${fileIndex + 1}/${totalFiles}, ${percent}%)`);
}

/*async function run() {
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);
    const subfolders = fs.readdirSync(inputFolder).filter(f => fs.statSync(path.join(inputFolder, f)).isDirectory());
    const allFiles = [];

    for (const sub of subfolders) {
        const subPath = path.join(inputFolder, sub);
        const bookTitle = sub === 'gita' ? 'Bhagavad-gītā As It Is' : sub === 'sb' ? 'Śrīmad Bhāgavatam' : 'Śrī Caitanya-caritāmṛta';
        const files = fs.readdirSync(subPath).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));
        const selected = testOnly ? files.slice(0, 1) : files;
        selected.forEach(file => allFiles.push({ path: path.join(subPath, file), bookTitle }));
    }

    const total = allFiles.length;
    for (let i = 0; i < total; i++) {
        await processFile(allFiles[i].path, allFiles[i].bookTitle, i, total);
    }
}*/

async function run() {
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

    // Look for text files in your OCR output folder
    const textFiles = fs.readdirSync(inputFolder)
        .filter(f => f.endsWith('.txt'))
        .map(f => ({
            path: path.join(inputFolder, f),
            bookTitle: guessBookTitle(f) // You'd need to add a function to determine the book from filename
        }));

    const total = textFiles.length;
    for (let i = 0; i < total; i++) {
        await processTextFile(textFiles[i].path, textFiles[i].bookTitle, i, total);
    }
}

run();

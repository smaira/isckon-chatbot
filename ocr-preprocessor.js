// ocr-preprocessor.js
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const { fromPath } = require('pdf2pic');

const inputRoot = path.join(__dirname, 'input');
const outputRoot = path.join(__dirname, 'ocr-output');

async function convertPDFtoText(pdfPath, outputPath, fileName) {
    const tempDir = path.join(__dirname, 'temp-images');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const options = {
        density: 300,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 1200,
        height: 1600,
    };

    const convert = fromPath(pdfPath, options);

    let worker;
    try {
        worker = await createWorker(['eng', 'san', 'ben']);
    } catch (err) {
        console.error("❌ Failed to initialize Tesseract worker:", err);
        return;
    }

    let fullText = '';
    let page = 1;

    console.log(`📄 ${fileName}`);

    while (true) {
        try {
            const result = await convert(page);
            const { data: { text } } = await worker.recognize(result.path);
            fullText += `\n--- Page ${page} ---\n` + text + '\n';
            process.stdout.write(`\r🔄 ${fileName} - Page ${page} complete`);
            page++;
        } catch (err) {
            break;
        }
    }

    console.log(`\n✅ Finished ${fileName} (${page - 1} pages)`);
    await worker.terminate();
    fs.writeFileSync(outputPath, fullText);
    console.log(`Saved: ${outputPath}`);
}

async function processAll() {
    if (!fs.existsSync(outputRoot)) fs.mkdirSync(outputRoot);

    const folders = fs.readdirSync(inputRoot).filter(f => fs.statSync(path.join(inputRoot, f)).isDirectory());

    for (const folder of folders) {
        const inputFolder = path.join(inputRoot, folder);
        const outputFolder = path.join(outputRoot, folder);
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

        const pdfFiles = fs.readdirSync(inputFolder).filter(f => f.endsWith('.pdf'));

        for (const file of pdfFiles) {
            const inputPath = path.join(inputFolder, file);
            const outputPath = path.join(outputFolder, file.replace(/\.pdf$/, '.txt'));
            await convertPDFtoText(inputPath, outputPath, file);
        }
    }
}

processAll();

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

// Set up OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate embedding for a single chunk
async function generateEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text,
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
}

// Process all chunk files in a directory
async function processDirectory(inputDir, outputDir) {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read all files in the input directory
    const files = fs.readdirSync(inputDir);

    for (const file of files) {
        if (file.endsWith('_chunks.json')) {
            console.log(`Processing file: ${file}`);

            // Read the chunk file
            const inputFilePath = path.join(inputDir, file);
            const chunks = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

            // Process each chunk
            for (let i = 0; i < chunks.length; i++) {
                console.log(`Processing chunk ${i + 1}/${chunks.length}`);

                // Generate embedding for the chunk
                chunks[i].embedding = await generateEmbedding(chunks[i].content);

                // Add a delay every few chunks to avoid rate limits
                if (i % 10 === 9) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Save the chunks with embeddings
            const outputFileName = file.replace('_chunks.json', '_with_embeddings.json');
            const outputFilePath = path.join(outputDir, outputFileName);
            fs.writeFileSync(outputFilePath, JSON.stringify(chunks, null, 2));
            console.log(`Saved embeddings to: ${outputFilePath}`);
        }
    }
}

// Main function
async function main() {
    // Get input and output directory paths from command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node generate-embeddings.js <input-directory> <output-directory>');
        process.exit(1);
    }

    const inputDir = args[0];
    const outputDir = args[1];

    if (!fs.existsSync(inputDir)) {
        console.error(`Input directory does not exist: ${inputDir}`);
        process.exit(1);
    }

    console.log(`Processing chunks from: ${inputDir}`);
    console.log(`Saving results to: ${outputDir}`);

    await processDirectory(inputDir, outputDir);
    console.log('Processing complete!');
}

main().catch(console.error);
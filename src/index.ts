// src/index.ts
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { CodeGraph, CodeGraphOptions, FileGraph, FileParser } from './types/interfaces';
import { createJsParser } from './parser/js-parser';
import { createReactParser } from './parser/react-parser';
import { createTsParser } from './parser/ts-parser';
import { IncrementalGraphBuilder } from './analyzer/graph-builder';
import { logger, readFile, ensureDir } from './utils/file-utils';
import { TaskQueue } from './utils/queue';
import { analyzeRelationships } from './analyzer/relationship-analyzer';


// Default file patterns to include
const DEFAULT_INCLUDE = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'];

// Default file patterns to exclude
const DEFAULT_EXCLUDE = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.min.*',
];


export async function createCodeGraph(options: CodeGraphOptions): Promise<CodeGraph> {
    const {
        projectName,
        rootDir,
        include = DEFAULT_INCLUDE,
        exclude = DEFAULT_EXCLUDE,
        concurrency = 10,
        includeDeclarations = false,
        includeNodeModules = false,
        customParsers = {},
        debug = false,
        outputPath,
        streamOutput = false,
    } = options;

    logger.setDebug(debug);
    logger.info(`Starting code graph generation for ${projectName}`);
    logger.info(`Root directory: ${rootDir}`);

    // If not including declarations, add them to exclude patterns
    let finalExclude = [...exclude];
    if (!includeDeclarations) {
        finalExclude.push('**/*.d.ts');
    }

    // If not including node_modules, make sure they're excluded
    if (!includeNodeModules && !finalExclude.includes('**/node_modules/**')) {
        finalExclude.push('**/node_modules/**');
    }

    // Initialize parsers for each file extension
    const parsers: Record<string, FileParser> = {
        '.js': customParsers['.js'] || createJsParser(),
        '.jsx': customParsers['.jsx'] || createReactParser(),
        '.ts': customParsers['.ts'] || createTsParser(), 
        '.tsx': customParsers['.tsx'] || createReactParser(), 
        ...customParsers,
    };

    // Initialize graph builder
    const graphBuilder = new IncrementalGraphBuilder(projectName);

    // Find all files matching the include/exclude patterns
    logger.info('Finding files to analyze...');
    const files = await glob(include, {
        cwd: rootDir,
        ignore: finalExclude,
        absolute: false,
        dot: false,
    });

    logger.info(`Found ${files.length} files to analyze`);

    // Create queue for parallel processing
    const queue = new TaskQueue(concurrency);
    let completedFiles = 0;

    // Add each file to the queue
    const promises = files.map(filePath =>
        queue.push(async () => {
            try {
                const fullPath = path.join(rootDir, filePath);
                const content = await readFile(fullPath);
                const ext = path.extname(filePath);

                // Find an appropriate parser for this file extension
                const parser = parsers[ext];
                if (!parser) {
                    logger.warn(`No parser found for ${ext}, skipping ${filePath}`);
                    return;
                }

                logger.debug(`Parsing ${filePath}`);
                const fileGraph = await parser.parse(filePath, content);

                // Add to graph
                graphBuilder.addFile(fileGraph);

                // Log progress periodically
                completedFiles++;
                if (debug && completedFiles % 50 === 0 || completedFiles === files.length) {
                    logger.debug(`Progress: ${completedFiles}/${files.length} files processed (${Math.round(completedFiles / files.length * 100)}%)`);
                }
            } catch (error) {
                logger.error(`Error processing ${filePath}:`, error);
            }
        })
    );

    // Wait for all tasks to complete
    await Promise.all(promises);
    await queue.waitForAll();
    logger.info('All files processed');

    // Generate the initial code graph
    logger.info('Generating initial code graph');
    const codeGraph = graphBuilder.getGraph();

    // Analyze relationships as a second pass
    logger.info('Analyzing relationships between code elements...');
    const codeGraphWithRelationships = analyzeRelationships(codeGraph);

    // If streaming output directly to file
    if (streamOutput && outputPath) {
        logger.info(`Streaming results to ${outputPath}`);

        // Ensure output directory exists
        await ensureDir(path.dirname(outputPath));

        // Create write stream
        const writeStream = fs.createWriteStream(outputPath);

        // Stream output - note: we may need to update graphBuilder to handle the enhanced graph
        await graphBuilder.writeToStream(writeStream);

        // Return empty graph since data was written to file
        return { name: projectName, packages: [] };
    }

    // Write to file if requested
    if (outputPath) {
        logger.info(`Writing results to ${outputPath}`);
        await ensureDir(path.dirname(outputPath));
        await fs.promises.writeFile(
            outputPath,
            JSON.stringify(codeGraphWithRelationships, null, 2), // Use the enhanced graph
            'utf-8'
        );
    }

    logger.info('Code graph generation complete');
    // Return the enhanced graph with relationships
    return codeGraphWithRelationships;
}

// Export types
export * from './types/interfaces';

// Default export for CommonJS compatibility
export default {
    createCodeGraph
};
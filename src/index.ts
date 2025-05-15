// src/index.ts
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { CodeGraph, CodeGraphOptions, FileGraph, FileParser, PackageGraph } from './types/interfaces';
import { createJsParser } from './parser/js-parser';
import { createReactParser } from './parser/react-parser';
import { createTsParser } from './parser/ts-parser';
import { IncrementalGraphBuilder } from './analyzer/graph-builder';
import { logger, readFile, ensureDir, fileExists } from './utils/file-utils';
import { TaskQueue } from './utils/queue';
import { analyzeRelationships } from './analyzer/relationship-analyzer';
import { normalizePath } from './utils/ast-utils';

const DEFAULT_INCLUDE = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'];
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

    // Set up exclusion patterns
    let finalExclude = [...exclude];
    if (!includeDeclarations) {
        finalExclude.push('**/*.d.ts');
    }
    if (!includeNodeModules && !finalExclude.includes('**/node_modules/**')) {
        finalExclude.push('**/node_modules/**');
    }

    // Configure parsers
    const parsers: Record<string, FileParser> = {
        '.js': customParsers['.js'] || createJsParser(),
        '.jsx': customParsers['.jsx'] || createReactParser(),
        '.ts': customParsers['.ts'] || createTsParser(),
        '.tsx': customParsers['.tsx'] || createReactParser(),
        ...customParsers,
    };

    // Create graph builder
    const graphBuilder = new IncrementalGraphBuilder(projectName, rootDir);

    // Find files to analyze with improved glob pattern
    logger.info('Finding files to analyze...');
    const files = await glob(include, {
        cwd: rootDir,
        ignore: finalExclude,
        absolute: false,
        dot: true, // Include dot files like .jsx
        nocase: false, // Preserve case
    });

    // Sort files to ensure consistent processing order
    files.sort((a, b) => a.localeCompare(b));

    logger.info(`Found ${files.length} files to analyze`);

    // Check for index.jsx specifically at the root (it's often missed)
    if (!files.some(f => f.toLowerCase() === 'index.jsx')) {
        const indexExists = await fileExists(path.join(rootDir, 'index.jsx'));
        if (indexExists) {
            files.push('index.jsx');
            logger.info('Added index.jsx file that was missed by glob');
        }
    }

    const queue = new TaskQueue(concurrency);
    let completedFiles = 0;
    const errors: Error[] = [];

    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchPromises = batch.map(filePath =>
            queue.push(async () => {
                try {
                    const fullPath = path.join(rootDir, filePath);
                    const content = await readFile(fullPath);

                    // Get file extension (case insensitive)
                    const ext = path.extname(filePath).toLowerCase();
                    const parser = parsers[ext];

                    if (!parser) {
                        logger.warn(`No parser found for ${ext}, skipping ${filePath}`);
                        return;
                    }

                    logger.debug(`Parsing ${filePath}`);
                    // Keep original case in filePath
                    const fileGraph = await parser.parse(filePath, content);
                    graphBuilder.addFile(fileGraph);

                    completedFiles++;
                    if (debug && completedFiles % 50 === 0 || completedFiles === files.length) {
                        logger.debug(`Progress: ${completedFiles}/${files.length} files processed (${Math.round(completedFiles / files.length * 100)}%)`);
                    }
                } catch (error) {
                    logger.error(`Error processing ${filePath}:`, error);
                    errors.push(error as Error);
                }
            })
        );

        await Promise.all(batchPromises);
    }

    await queue.waitForAll();

    if (errors.length > 0) {
        logger.warn(`Completed with ${errors.length} errors. Some files may not be included in the graph.`);
    }

    logger.info('All files processed');
    logger.info('Generating initial code graph');

    const codeGraph = graphBuilder.getGraph();

    // Ensure root package is properly represented
    ensurePackageStructure(codeGraph);

    logger.info('Analyzing relationships between code elements...');
    const codeGraphWithRelationships = analyzeRelationships(codeGraph);

    if (streamOutput && outputPath) {
        logger.info(`Streaming results to ${outputPath}`);
        await ensureDir(path.dirname(outputPath));
        const writeStream = fs.createWriteStream(outputPath);
        await graphBuilder.writeToStream(writeStream);
        return codeGraphWithRelationships; // Return enhanced graph even when streaming
    }

    if (outputPath) {
        logger.info(`Writing results to ${outputPath}`);
        await ensureDir(path.dirname(outputPath));
        await fs.promises.writeFile(
            outputPath,
            JSON.stringify(codeGraphWithRelationships, null, 2),
            'utf-8'
        );
    }

    logger.info('Code graph generation complete');
    return codeGraphWithRelationships;
}

/**
 * Ensures the package structure has both root and src packages if needed
 */
/**
 * Ensures the package structure has both root and src packages with correct dependencies
 */
function ensurePackageStructure(codeGraph: CodeGraph): void {
    // Find if we have root and src packages
    let rootPackage = codeGraph.packages.find(p => p.name === '.' || p.name === '');
    const srcPackage = codeGraph.packages.find(p => p.name === 'src');

    // Check for files at root level
    const rootFiles: FileGraph[] = [];
    const srcFiles: FileGraph[] = [];

    // Organize files into correct packages
    for (const pkg of codeGraph.packages) {
        for (const file of pkg.files) {
            if (file.path.startsWith('src/')) {
                srcFiles.push(file);
            } else if (!file.path.includes('/')) {
                rootFiles.push(file);
            }
        }
    }

    // Create or update src package
    if (srcFiles.length > 0) {
        if (!srcPackage) {
            codeGraph.packages.push({
                name: 'src',
                files: srcFiles,
                dependencies: [],
                exports: srcFiles.flatMap(f => f.exports || [])
            });
        } else {
            // Update src package files
            srcPackage.files = srcFiles;
            srcPackage.exports = srcFiles.flatMap(f => f.exports || []);
        }
    }

    // Create or update root package
    if (rootFiles.length > 0) {
        if (!rootPackage) {
            rootPackage = {
                name: '.',
                files: rootFiles,
                dependencies: [],
                exports: rootFiles.flatMap(f => f.exports || [])
            };
            codeGraph.packages.push(rootPackage);
        } else {
            // Update root package files
            rootPackage.files = rootFiles;
            rootPackage.exports = rootFiles.flatMap(f => f.exports || []);
        }
    }

    // Analyze dependencies between packages
    for (const pkg of codeGraph.packages) {
        const packageDeps = new Set<string>();

        for (const file of pkg.files) {
            // Check each file dependency
            for (const dep of file.dependencies || []) {
                // Skip external/absolute dependencies
                if (!dep.startsWith('.')) continue;

                // Follow the relative import
                const fileDir = path.dirname(file.path);
                let resolvedPath = normalizePath(path.join(fileDir, dep));

                // Find the target package
                let targetPkg: string | undefined;

                // Check if this path points to files in another package
                for (const otherPkg of codeGraph.packages) {
                    if (otherPkg === pkg) continue; // Skip self

                    // Try to match by exact path or directory
                    const matchesFile = otherPkg.files.some(f => {
                        // Try with extensions
                        if (path.extname(resolvedPath) === '') {
                            const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                            for (const ext of extensions) {
                                if (f.path === `${resolvedPath}${ext}`) {
                                    return true;
                                }
                            }
                            return false;
                        } else {
                            return f.path === resolvedPath;
                        }
                    });

                    // Try directory match (for index files)
                    const matchesDir = otherPkg.files.some(f =>
                        f.path.startsWith(`${resolvedPath}/`) ||
                        f.path === `${resolvedPath}/index.js` ||
                        f.path === `${resolvedPath}/index.jsx` ||
                        f.path === `${resolvedPath}/index.ts` ||
                        f.path === `${resolvedPath}/index.tsx`
                    );

                    if (matchesFile || matchesDir) {
                        targetPkg = otherPkg.name;
                        break;
                    }
                }

                if (targetPkg) {
                    packageDeps.add(targetPkg);
                }
            }
        }

        // Update package dependencies
        pkg.dependencies = Array.from(packageDeps);
    }

    // Special case: if rootPackage imports from src and not vice versa, add the dependency
    if (rootPackage && srcPackage) {
        // Check file dependencies
        const hasSrcDep = rootPackage.files.some(file =>
            file.dependencies?.some(dep => dep === './src' || dep.startsWith('./src/'))
        );

        // Check detailed imports for the App case
        const hasAppDep = rootPackage.files.some(file =>
            file.dependencies?.some(dep => dep === './App') ||
            (file.detailedDependencies?.some(dep =>
                dep.module === './App' || dep.module === './src/App'
            ))
        );

        if ((hasSrcDep || hasAppDep) && !rootPackage.dependencies.includes('src')) {
            rootPackage.dependencies.push('src');
        }
    }
}

export * from './types/interfaces';
export default {
    createCodeGraph
};
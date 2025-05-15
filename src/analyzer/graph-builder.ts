
// src/analyzer/graph-builder.ts
import path from 'path';
import fs from 'fs';
import { CodeGraph, FileGraph, GraphBuilder, PackageGraph } from '../types/interfaces';
import { logger } from '../utils/file-utils';
import { normalizePath } from '../utils/ast-utils';

/**
 * IncrementalGraphBuilder builds a code graph incrementally as files are added.
 * Optimized for handling large codebases efficiently.
 */
export class IncrementalGraphBuilder implements GraphBuilder {
    private projectName: string;
    private packageMap: Map<string, PackageGraph>;
    private fileMap: Map<string, FileGraph>; // For quick lookups
    private rootDir: string | null = null;

    constructor(projectName: string, rootDir?: string) {
        this.projectName = projectName;
        this.packageMap = new Map();
        this.fileMap = new Map();

        if (rootDir) {
            this.rootDir = normalizePath(rootDir);
        }
    }

    /**
     * Add a file to the graph, creating the package if it doesn't exist.
     */
    public addFile(fileGraph: FileGraph): void {
        // Ensure path is normalized
        const normalizedPath = normalizePath(fileGraph.path);
        fileGraph.path = normalizedPath;

        // Store file in map for quick lookups
        this.fileMap.set(normalizedPath, fileGraph);

        // Determine package name from directory
        const packageName = normalizePath(path.dirname(normalizedPath));

        // Create package if it doesn't exist
        if (!this.packageMap.has(packageName)) {
            this.packageMap.set(packageName, {
                name: packageName,
                files: [],
                dependencies: [],
                exports: []
            });
        }

        const pkg = this.packageMap.get(packageName)!;

        // Add file to package
        pkg.files.push(fileGraph);

        // Update package exports
        for (const exportName of fileGraph.exports) {
            if (!pkg.exports.includes(exportName)) {
                pkg.exports.push(exportName);
            }
        }
    }

    /**
     * Get the complete code graph.
     */
    public getGraph(): CodeGraph {
        logger.info('Finalizing code graph...');

        // Analyze dependencies between packages
        this.analyzePackageDependencies();

        const packages = Array.from(this.packageMap.values());

        // Sort packages for consistent output
        packages.sort((a, b) => a.name.localeCompare(b.name));

        return {
            name: this.projectName,
            packages
        };
    }

    /**
     * Write the graph to a stream, useful for large graphs.
     */
    public async writeToStream(writeStream: NodeJS.WritableStream): Promise<void> {
        logger.info('Streaming code graph to output...');

        // Analyze dependencies between packages
        this.analyzePackageDependencies();

        writeStream.write('{\n');
        writeStream.write(`  "name": ${JSON.stringify(this.projectName)},\n`);
        writeStream.write('  "packages": [\n');

        const packageNames = Array.from(this.packageMap.keys()).sort();

        for (let i = 0; i < packageNames.length; i++) {
            const pkg = this.packageMap.get(packageNames[i])!;

            if (i > 0) {
                writeStream.write(',\n');
            }

            const json = JSON.stringify(pkg, null, 2);
            const indentedJson = json
                .split('\n')
                .map((line, j) => j === 0 ? `    ${line}` : `      ${line}`)
                .join('\n');

            writeStream.write(indentedJson);
        }

        writeStream.write('\n  ]\n}');
    }

    /**
     * Find a file in the graph by its path.
     * Handles various path formats and extensions.
     */
    public findFileByPath(filePath: string): FileGraph | undefined {
        const normalizedPath = normalizePath(filePath);

        // Direct lookup
        if (this.fileMap.has(normalizedPath)) {
            return this.fileMap.get(normalizedPath);
        }

        // Try with different extensions if no extension provided
        if (!path.extname(normalizedPath)) {
            const extensions = ['.js', '.jsx', '.ts', '.tsx'];
            for (const ext of extensions) {
                const pathWithExt = `${normalizedPath}${ext}`;
                if (this.fileMap.has(pathWithExt)) {
                    return this.fileMap.get(pathWithExt);
                }
            }

            // Try for index files
            for (const ext of extensions) {
                const indexPath = `${normalizedPath}/index${ext}`;
                if (this.fileMap.has(indexPath)) {
                    return this.fileMap.get(indexPath);
                }
            }
        }

        // Try without extension
        const pathWithoutExt = normalizedPath.replace(/\.[^/.]+$/, '');
        for (const filePath of this.fileMap.keys()) {
            const filePathWithoutExt = filePath.replace(/\.[^/.]+$/, '');
            if (filePathWithoutExt === pathWithoutExt) {
                return this.fileMap.get(filePath);
            }
        }

        return undefined;
    }

    /**
     * Resolve an import path to an absolute path.
     */
    private resolveImportPath(importerPath: string, importPath: string): string {
        // Handle package imports (node_modules)
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return importPath; // External package
        }

        // Get directory of importer
        const importerDir = path.dirname(importerPath);

        // Resolve relative path
        let resolvedPath = normalizePath(path.resolve(importerDir, importPath));

        return resolvedPath;
    }

    /**
     * Analyze dependencies between packages based on file imports.
     */
    private analyzePackageDependencies(): void {
        for (const [packageName, pkg] of this.packageMap.entries()) {
            const dependencies = new Set<string>();

            for (const file of pkg.files) {
                // Process each dependency of the file
                for (const depPath of file.dependencies) {
                    try {
                        // Skip node_modules or absolute imports for package dependency analysis
                        if (!depPath.startsWith('.') && !depPath.startsWith('/')) {
                            continue; // Skip external packages for package dependencies
                        }

                        // Resolve the import path to a file path
                        const resolvedPath = this.resolveImportPath(file.path, depPath);

                        // Find the actual file this import refers to
                        const depFile = this.findFileByPath(resolvedPath);

                        if (depFile) {
                            // Get the package of the dependency
                            const depPackageName = normalizePath(path.dirname(depFile.path));

                            // Add as a dependency if it's a different package
                            if (depPackageName !== packageName) {
                                dependencies.add(depPackageName);
                            }
                        } else {
                            // Try just using the directory
                            const normalizedPath = normalizePath(path.dirname(resolvedPath));

                            if (normalizedPath !== packageName && this.packageMap.has(normalizedPath)) {
                                dependencies.add(normalizedPath);
                            }
                        }
                    } catch (error) {
                        logger.warn(`Error resolving dependency ${depPath} from ${file.path}: ${error}`);
                    }
                }
            }

            // Update package dependencies
            pkg.dependencies = Array.from(dependencies).sort();
        }
    }
}
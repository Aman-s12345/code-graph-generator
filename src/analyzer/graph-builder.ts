
import path from 'path';
import fs from 'fs';
import { CodeGraph, FileGraph, GraphBuilder, PackageGraph } from '../types/interfaces';
import { logger } from '../utils/file-utils';


export class IncrementalGraphBuilder implements GraphBuilder {
    private projectName: string;
    private packageMap: Map<string, PackageGraph>;

    constructor(projectName: string) {
        this.projectName = projectName;
        this.packageMap = new Map();
    }

   
    public addFile(fileGraph: FileGraph): void {
        const packageName = path.dirname(fileGraph.path);

        if (!this.packageMap.has(packageName)) {
            this.packageMap.set(packageName, {
                name: packageName,
                files: [],
                dependencies: [],
                exports: [],
            });
        }

        const pkg = this.packageMap.get(packageName)!;

        pkg.files.push(fileGraph);

        for (const exportName of fileGraph.exports) {
            if (!pkg.exports.includes(exportName)) {
                pkg.exports.push(exportName);
            }
        }

     
    }

   
    public getGraph(): CodeGraph {
        logger.info('Finalizing code graph...');

        
        this.analyzePackageDependencies();
        const packages = Array.from(this.packageMap.values());
        return {
            name: this.projectName,
            packages,
        };
    }


    public async writeToStream(writeStream: NodeJS.WritableStream): Promise<void> {
        logger.info('Streaming code graph to output...');

      
        this.analyzePackageDependencies();
        writeStream.write('{\n');
        writeStream.write(`  "name": ${JSON.stringify(this.projectName)},\n`);
        writeStream.write('  "packages": [\n');
        let isFirst = true;
        for (const [_, pkg] of this.packageMap.entries()) {
            if (!isFirst) {
                writeStream.write(',\n');
            }
            isFirst = false;
            const json = JSON.stringify(pkg, null, 2);
            const indentedJson = json
                .split('\n')
                .map((line, i) => i === 0 ? `    ${line}` : `      ${line}`)
                .join('\n');

            writeStream.write(indentedJson);
        }
        writeStream.write('\n  ]\n}');
    }

   
    private analyzePackageDependencies(): void {
        for (const [packageName, pkg] of this.packageMap.entries()) {
            const dependencies = new Set<string>();

        
            for (const file of pkg.files) {
               
                for (const depPath of file.dependencies) {
                   
                    if (depPath.startsWith('/') || !depPath.startsWith('.')) {
                        continue;
                    }

                  
                    const resolvedPath = path.resolve(path.dirname(file.path), depPath);
                    const normalizedPath = path.dirname(resolvedPath);

                   
                    if (normalizedPath !== packageName && this.packageMap.has(normalizedPath)) {
                        dependencies.add(normalizedPath);
                    }
                }
            }
            pkg.dependencies = Array.from(dependencies);
        }
    }
}
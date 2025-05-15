
export interface CodeGraph {
    name: string;
    packages: PackageGraph[];
}


export interface PackageGraph {
    name: string;
    files: FileGraph[];
    dependencies: string[];
    exports: string[];
}

export interface FileGraph {
    path: string;
    types: TypeGraph[];
    variables: VariableGraph[];
    functions: FunctionGraph[];
    dependencies: string[];
    exports: string[];
    detailedDependencies?: {
        module: string;
        imports: string[];
    }[];
    componentHierarchy?: Record<string, {
        renders: string[];
        renderedBy: string[];
    }>;
}

export interface FunctionGraph {
    fileName: string;
    name: string;
    referencedIn: string[];
    startLine: number;
    length: number;
    dependencies: Array<Record<string, string>>;
    types: string[];
    callsTo?: string[];
    calledBy?: string[];
}

export interface VariableGraph {
    name: string;
    type?: string;
    dependencies: Array<Record<string, string>>;
}

export interface TypeGraph {
    name: string;
    file: string;
    startLine: number;
    length: number;
    properties: MemberGraph[];
}

export interface MemberGraph {
    name: string;
    type?: string;
    parameters?: string[];
}

export interface CodeGraphOptions {
    projectName: string;
    rootDir: string;
    include?: string[];
    exclude?: string[];
    concurrency?: number;
    includeDeclarations?: boolean;
    includeNodeModules?: boolean;
    customParsers?: Record<string, FileParser>;
    debug?: boolean;
    outputPath?: string;
    streamOutput?: boolean;
    batchSize?: number;
}


export interface FileParser {
    parse(filePath: string, content: string): Promise<FileGraph>;
}

export interface GraphBuilder {
    addFile(fileGraph: FileGraph): void;
    getGraph(): CodeGraph;
    writeToStream(writeStream: NodeJS.WritableStream): Promise<void>;
}
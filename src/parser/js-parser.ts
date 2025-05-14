import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import path from 'path';
import { FileGraph, FileParser, FunctionGraph, TypeGraph, VariableGraph } from '../types/interfaces';
import { getStartLine, countLines, lightTraverse } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';

export function createJsParser(): FileParser {
    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`JS Parser: parsing ${filePath}`);

            const fileGraph: FileGraph = {
                path: filePath,
                types: [],
                variables: [],
                functions: [],
                dependencies: [],
                exports: [],
            };

            try {
                const ast = parse(content, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript', 'classProperties', 'dynamicImport', 'objectRestSpread', 'optionalChaining'],
                    errorRecovery: true,
                });

                const rootFunction: FunctionGraph = {
                    name: 'root',
                    referencedIn: [],
                    startLine: 1,
                    length: countLines(content),
                    dependencies: [],
                    types: [],
                    fileName: path.basename(filePath),
                };

                fileGraph.functions.push(rootFunction);

                // Build parent map for scope tracking
                const parentMap = new Map();
                const buildParentMap = (node: any, parent: any) => {
                    if (node && typeof node === 'object') {
                        parentMap.set(node, parent);

                        for (const key in node) {
                            if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
                                const child = node[key];
                                if (child && typeof child === 'object') {
                                    if (Array.isArray(child)) {
                                        child.forEach(item => buildParentMap(item, node));
                                    } else {
                                        buildParentMap(child, node);
                                    }
                                }
                            }
                        }
                    }
                };

                buildParentMap(ast, null);

                const visitors = {
                    
                    ImportDeclaration: (node: any) => {
                        const source = node.source.value;

                        // Create a detailed import record instead of just a string
                        const importRecord = {
                            module: source,
                            imports: node.specifiers.map((specifier: any) => {
                                if (specifier.type === 'ImportSpecifier') {
                                    return specifier.imported.name; // Named import
                                }
                                else if (specifier.type === 'ImportDefaultSpecifier') {
                                    return 'default'; // Default import
                                }
                                return null;
                            }).filter(Boolean)
                        };

                        // Add to a new detailed dependencies array
                        fileGraph.detailedDependencies = fileGraph.detailedDependencies || [];
                        fileGraph.detailedDependencies.push(importRecord);

                        // Keep original dependencies for backward compatibility
                        if (!fileGraph.dependencies.includes(source)) {
                            fileGraph.dependencies.push(source);
                        }
                    }
                    ,
                    ExportNamedDeclaration: (node: any) => {
                        if (node.declaration) {
                            if (
                                node.declaration.type === 'FunctionDeclaration' &&
                                node.declaration.id
                            ) {
                                const name = node.declaration.id.name;
                                if (!fileGraph.exports.includes(name)) {
                                    fileGraph.exports.push(name);
                                }
                            } else if (node.declaration.type === 'VariableDeclaration') {
                                node.declaration.declarations.forEach((decl: any) => {
                                    if (decl.id.type === 'Identifier') {
                                        const name = decl.id.name;
                                        if (!fileGraph.exports.includes(name)) {
                                            fileGraph.exports.push(name);
                                        }
                                    }
                                });
                            }
                        }

                        node.specifiers.forEach((specifier: any) => {
                            if (specifier.type === 'ExportSpecifier') {
                                const name = specifier.exported.name;
                                if (!fileGraph.exports.includes(name)) {
                                    fileGraph.exports.push(name);
                                }
                            }
                        });
                    },

                    ExportDefaultDeclaration: () => {
                        if (!fileGraph.exports.includes('default')) {
                            fileGraph.exports.push('default');
                        }
                    },

                    FunctionDeclaration: (node: any) => {
                        if (isTopLevel(node, parentMap) && node.id) {
                            const name = node.id.name;
                            const startLine = getStartLine(node);
                            const functionGraph: FunctionGraph = {
                                name,
                                referencedIn: [filePath],
                                startLine,
                                length: node.body ? countLines(
                                    content.substring(
                                        node.body.start || 0,
                                        node.body.end || content.length
                                    )
                                ) : 0,
                                dependencies: [],
                                types: inferFunctionReturnType(node),
                                fileName: path.basename(filePath),
                            };

                            fileGraph.functions.push(functionGraph);
                        }
                    },

                    VariableDeclaration: (node: any) => {
                        // Only process top-level declarations
                        if (isTopLevel(node, parentMap)) {
                            node.declarations.forEach((declaration: any) => {
                                if (declaration.id.type === 'Identifier') {
                                    const name = declaration.id.name;
                                    const variableGraph: VariableGraph = {
                                        name,
                                        type: inferVariableType(declaration.init),
                                        dependencies: [],
                                    };

                                    fileGraph.variables.push(variableGraph);

                                    // Check if this is a function expression assigned to a variable
                                    if (declaration.init &&
                                        (declaration.init.type === 'FunctionExpression' ||
                                            declaration.init.type === 'ArrowFunctionExpression')) {

                                        const functionGraph: FunctionGraph = {
                                            name,
                                            referencedIn: [filePath],
                                            startLine: getStartLine(declaration),
                                            length: declaration.init.body ? countLines(
                                                content.substring(
                                                    declaration.init.body.start || 0,
                                                    declaration.init.body.end || content.length
                                                )
                                            ) : 0,
                                            dependencies: [],
                                            types: inferFunctionReturnType(declaration.init),
                                            fileName: path.basename(filePath),
                                        };

                                        fileGraph.functions.push(functionGraph);
                                    }
                                }
                            });
                        }
                    },

                    // Catch class declarations at the top level
                    ClassDeclaration: (node: any) => {
                        if (isTopLevel(node, parentMap) && node.id) {
                            const name = node.id.name;

                            // Add class as a "type"
                            const typeGraph: TypeGraph = {
                                name,
                                file: filePath,
                                startLine: getStartLine(node),
                                length: node.body ? (
                                    node.body.end - node.body.start > 0 ?
                                        countLines(content.substring(node.body.start, node.body.end)) : 1
                                ) : 0,
                                properties: extractClassProperties(node),
                            };

                            fileGraph.types.push(typeGraph);
                        }
                    },
                };

                lightTraverse(ast, visitors);

                return fileGraph;
            } catch (error) {
                logger.error(`Error parsing ${filePath}:`, error);
                throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
            }
        }
    };
}

function extractClassProperties(node: any): any[] {
    const properties = [];

    if (node.body && node.body.body) {
        for (const member of node.body.body) {
            if (member.type === 'ClassProperty' || member.type === 'ClassMethod') {
                const name = member.key && member.key.name ? member.key.name :
                    (member.key && member.key.value ? member.key.value : 'anonymous');

                properties.push({
                    name,
                    type: member.type === 'ClassMethod' ? 'method' : 'property',
                    // You could extract parameter information for methods here
                });
            }
        }
    }

    return properties;
}

// Helper function to check if a node is at the top level
function isTopLevel(node: any, parentMap: Map<any, any>): boolean {
    let current = node;
    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);
        // If we reach the Program node directly, it's top level
        if (parent && parent.type === 'Program') {
            return true;
        }

        // If we reach a FunctionDeclaration or other scope creator,
        // and it's not directly under Program, it's not top level
        if (
            parent &&
            (parent.type === 'FunctionDeclaration' ||
                parent.type === 'ArrowFunctionExpression' ||
                parent.type === 'FunctionExpression' ||
                parent.type === 'BlockStatement')
        ) {
            return false;
        }

        current = parent;
    }

    return false;
}

function inferFunctionReturnType(node: any): string[] {
    if (node.returnType && node.returnType.typeAnnotation) {
        const typeAnnotation = node.returnType.typeAnnotation;

        if (typeAnnotation.type === 'TSNumberKeyword') {
            return ['number'];
        } else if (typeAnnotation.type === 'TSStringKeyword') {
            return ['string'];
        } else if (typeAnnotation.type === 'TSBooleanKeyword') {
            return ['boolean'];
        }
    }

    return [];
}

function inferVariableType(init: any): string | undefined {
    if (!init) return undefined;

    switch (init.type) {
        case 'NumericLiteral':
            return 'number';
        case 'StringLiteral':
            return 'string';
        case 'BooleanLiteral':
            return 'boolean';
        case 'ObjectExpression':
            return 'Object';
        case 'ArrayExpression':
            return 'Array';
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
            return 'Function';
        default:
            return undefined;
    }
}

function findFunctionCalls(functionNode: any, content: string): string[] {
    const calls: string[] = [];

    const visitors = {
        CallExpression: (node: any) => {
            if (node.callee.type === 'Identifier') {
                calls.push(node.callee.name);
            }
            else if (node.callee.type === 'MemberExpression' &&
                node.callee.property.type === 'Identifier') {
                calls.push(node.callee.property.name);
            }
        }
    };

    // Only traverse the function body
    lightTraverse(functionNode.body, visitors);

    return calls;
}

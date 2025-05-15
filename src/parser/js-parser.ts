// // src/parser/js-parser.js
// import { parse } from '@babel/parser';
// import traverse from '@babel/traverse';
// import * as t from '@babel/types';
// import path from 'path';
// import { FileGraph, FileParser, FunctionGraph, TypeGraph, VariableGraph } from '../types/interfaces';
// import { getStartLine, countLines, lightTraverse } from '../utils/ast-utils';
// import { logger } from '../utils/file-utils';
// import { normalizePath } from '../utils/ast-utils';

// export function createJsParser(): FileParser {
//     return {
//         async parse(filePath: string, content: string): Promise<FileGraph> {
//             logger.debug(`JS Parser: parsing ${filePath}`);
//             const fileGraph: FileGraph = {
//                 path: normalizePath(filePath),
//                 types: [],
//                 variables: [],
//                 functions: [],
//                 dependencies: [],
//                 exports: [],
//             };
//             try {
//                 const ast = parse(content, {
//                     sourceType: 'module',
//                     plugins: ['jsx', 'typescript', 'classProperties', 'dynamicImport', 'objectRestSpread', 'optionalChaining'],
//                     errorRecovery: true,
//                 });
//                 const rootFunction: FunctionGraph = {
//                     name: 'root',
//                     referencedIn: [],
//                     startLine: 1,
//                     length: countLines(content),
//                     dependencies: [],
//                     types: [],
//                     fileName: path.basename(filePath),
//                 };
//                 fileGraph.functions.push(rootFunction);
//                 const parentMap = new Map();
//                 const buildParentMap = (node: any, parent: any) => {
//                     if (node && typeof node === 'object') {
//                         parentMap.set(node, parent);
//                         for (const key in node) {
//                             if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
//                                 const child = node[key];
//                                 if (child && typeof child === 'object') {
//                                     if (Array.isArray(child)) {
//                                         child.forEach(item => buildParentMap(item, node));
//                                     } else {
//                                         buildParentMap(child, node);
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                 };
//                 buildParentMap(ast, null);
//                 const visitors = {
//                     ImportDeclaration: (node: any) => {
//                         const source = node.source.value;
//                         const importedNames: any = [];

//                         node.specifiers.forEach((specifier: any) => {
//                             let importName;
//                             if (specifier.type === 'ImportSpecifier') {
//                                 importName = specifier.imported.name;
//                                 importedNames.push(importName);
//                             }
//                             else if (specifier.type === 'ImportDefaultSpecifier') {
//                                 importName = 'default';
//                                 if (specifier.local && specifier.local.name) {
//                                     importedNames.push(specifier.local.name);
//                                 }
//                             }
//                         });

//                         // Add to file dependencies
//                         const importRecord = {
//                             module: source,
//                             imports: importedNames.filter(Boolean)
//                         };

//                         fileGraph.detailedDependencies = fileGraph.detailedDependencies || [];
//                         fileGraph.detailedDependencies.push(importRecord);

//                         if (!fileGraph.dependencies.includes(source)) {
//                             fileGraph.dependencies.push(source);
//                         }

//                         // Add to root function dependencies
//                         const rootFn = fileGraph.functions.find(fn => fn.name === 'root');
//                         if (rootFn) {
//                             node.specifiers.forEach((specifier: any) => {
//                                 const importName = specifier.type === 'ImportSpecifier'
//                                     ? specifier.imported.name
//                                     : (specifier.local ? specifier.local.name : 'default');

//                                 if (importName) {
//                                     // Using the standard dependency format
//                                     rootFn.dependencies.push({ [importName]: source });
//                                 }
//                             });
//                         }
//                     },
//                     ExportNamedDeclaration: (node: any) => {
//                         if (node.declaration) {
//                             if (
//                                 node.declaration.type === 'FunctionDeclaration' &&
//                                 node.declaration.id
//                             ) {
//                                 const name = node.declaration.id.name;
//                                 if (!fileGraph.exports.includes(name)) {
//                                     fileGraph.exports.push(name);
//                                 }
//                             } else if (node.declaration.type === 'VariableDeclaration') {
//                                 node.declaration.declarations.forEach((decl: any) => {
//                                     if (decl.id.type === 'Identifier') {
//                                         const name = decl.id.name;
//                                         if (!fileGraph.exports.includes(name)) {
//                                             fileGraph.exports.push(name);
//                                         }
//                                     }
//                                 });
//                             }
//                         }
//                         node.specifiers.forEach((specifier: any) => {
//                             if (specifier.type === 'ExportSpecifier') {
//                                 const name = specifier.exported.name;
//                                 if (!fileGraph.exports.includes(name)) {
//                                     fileGraph.exports.push(name);
//                                 }
//                             }
//                         });
//                     },
//                     ExportDefaultDeclaration: () => {
//                         if (!fileGraph.exports.includes('default')) {
//                             fileGraph.exports.push('default');
//                         }
//                     },
//                     FunctionDeclaration: (node: any) => {
//                         if (node.id) {
//                             const name = node.id.name;
//                             const startLine = getStartLine(node);

//                             // For top-level functions
//                             if (isTopLevel(node, parentMap)) {
//                                 const functionGraph: FunctionGraph = {
//                                     name,
//                                     referencedIn: [normalizePath(filePath)],
//                                     startLine,
//                                     length: node.body ? countLines(
//                                         content.substring(
//                                             node.body.start || 0,
//                                             node.body.end || content.length
//                                         )
//                                     ) : 0,
//                                     dependencies: [],
//                                     types: inferFunctionReturnType(node),
//                                     fileName: path.basename(filePath),
//                                     callsTo: findFunctionCalls(node, content),
//                                 };

//                                 fileGraph.functions.push(functionGraph);
//                             }
//                             // For functions inside components (like handleClick)
//                             else if (isInComponent(node, parentMap)) {
//                                 const functionGraph: FunctionGraph = {
//                                     name,
//                                     referencedIn: [normalizePath(filePath)],
//                                     startLine,
//                                     length: node.body ? countLines(
//                                         content.substring(
//                                             node.body.start || 0,
//                                             node.body.end || content.length
//                                         )
//                                     ) : 0,
//                                     dependencies: [],
//                                     types: inferFunctionReturnType(node),
//                                     fileName: path.basename(filePath),
//                                     callsTo: findFunctionCalls(node, content),
//                                 };

//                                 if (!fileGraph.functions.some(fn => fn.name === name)) {
//                                     fileGraph.functions.push(functionGraph);
//                                 }
//                             }
//                         }
//                     },
//                     VariableDeclaration: (node: any) => {
//                         if (isTopLevel(node, parentMap)) {
//                             node.declarations.forEach((declaration: any) => {
//                                 if (declaration.id.type === 'Identifier') {
//                                     const name = declaration.id.name;
//                                     const variableGraph: VariableGraph = {
//                                         name,
//                                         type: inferVariableType(declaration.init),
//                                         dependencies: [],
//                                     };

//                                     fileGraph.variables.push(variableGraph);
//                                     if (declaration.init &&
//                                         (declaration.init.type === 'FunctionExpression' ||
//                                             declaration.init.type === 'ArrowFunctionExpression')) {
//                                         const functionGraph: FunctionGraph = {
//                                             name,
//                                             referencedIn: [normalizePath(filePath)],
//                                             startLine: getStartLine(declaration),
//                                             length: declaration.init.body ? countLines(
//                                                 content.substring(
//                                                     declaration.init.body.start || 0,
//                                                     declaration.init.body.end || content.length
//                                                 )
//                                             ) : 0,
//                                             dependencies: [],
//                                             types: inferFunctionReturnType(declaration.init),
//                                             fileName: path.basename(filePath),
//                                             callsTo: findFunctionCalls(declaration.init, content),
//                                         };

//                                         fileGraph.functions.push(functionGraph);
//                                     }
//                                 }
//                             });
//                         }
//                         // Also check for arrow functions inside components
//                         else if (isInComponent(node, parentMap)) {
//                             node.declarations.forEach((decl: any) => {
//                                 if (decl.id?.type === 'Identifier' &&
//                                     decl.init?.type === 'ArrowFunctionExpression') {
//                                     const name = decl.id.name;
//                                     const startLine = getStartLine(decl.init);

//                                     const functionGraph: FunctionGraph = {
//                                         fileName: path.basename(filePath),
//                                         name,
//                                         referencedIn: [normalizePath(filePath)],
//                                         startLine,
//                                         length: decl.init.body ? countLines(
//                                             content.substring(
//                                                 decl.init.body.start || 0,
//                                                 decl.init.body.end || content.length
//                                             )
//                                         ) : 0,
//                                         dependencies: [],
//                                         types: inferFunctionReturnType(decl.init),
//                                         callsTo: findFunctionCalls(decl.init, content),
//                                     };

//                                     if (!fileGraph.functions.some(fn => fn.name === name)) {
//                                         fileGraph.functions.push(functionGraph);
//                                     }
//                                 }
//                             });
//                         }
//                     },
//                     ClassDeclaration: (node: any) => {
//                         if (isTopLevel(node, parentMap) && node.id) {
//                             const name = node.id.name;
//                             const typeGraph: TypeGraph = {
//                                 name,
//                                 file: filePath,
//                                 startLine: getStartLine(node),
//                                 length: node.body ? (
//                                     node.body.end - node.body.start > 0 ?
//                                         countLines(content.substring(node.body.start, node.body.end)) : 1
//                                 ) : 0,
//                                 properties: extractClassProperties(node),
//                             };
//                             fileGraph.types.push(typeGraph);
//                         }
//                     },
//                 };
//                 lightTraverse(ast, visitors);
//                 fileGraph.functions.forEach(fn => {
//                     if (fn.callsTo && fn.callsTo.length > 0) {
//                         // Get the set of imported function names
//                         const importedFunctions = new Set();
//                         const rootFn = fileGraph.functions.find(f => f.name === 'root');

//                         if (rootFn && rootFn.dependencies) {
//                             rootFn.dependencies.forEach(dep => {
//                                 const importName = Object.keys(dep)[0];
//                                 if (importName && importName !== 'default') {
//                                     importedFunctions.add(importName);
//                                 }
//                             });
//                         }

//                         // Keep both local functions and imported functions
//                         fn.callsTo = fn.callsTo.filter(calledName => {
//                             return fileGraph.functions.some(f => f.name === calledName) ||
//                                 importedFunctions.has(calledName);
//                         });
//                     }
//                 });
//                 // Process import usages in functions
//                 const importedFunctionMap = new Map();
//                 const rootFn = fileGraph.functions.find(fn => fn.name === 'root');

//                 if (rootFn && rootFn.dependencies) {
//                     rootFn.dependencies.forEach(dep => {
//                         const importName = Object.keys(dep)[0];
//                         const importSource = dep[importName];
//                         if (importName) {
//                             importedFunctionMap.set(importName, importSource);
//                         }
//                     });
//                 }

//                 // Check each function's callsTo to link imported functions
//                 fileGraph.functions.forEach(fn => {
//                     if (fn.callsTo) {
//                         // Create a dependencies array if it doesn't exist
//                         fn.dependencies = fn.dependencies || [];

//                         fn.callsTo.forEach(calledName => {
//                             if (importedFunctionMap.has(calledName)) {
//                                 // Add the import source to function dependencies
//                                 const importSource = importedFunctionMap.get(calledName);
//                                 const depExists = fn.dependencies.some(dep =>
//                                     Object.keys(dep)[0] === calledName &&
//                                     Object.values(dep)[0] === importSource
//                                 );

//                                 if (!depExists) {
//                                     fn.dependencies.push({ [calledName]: importSource });
//                                 }
//                             }
//                         });
//                     }
//                 });

//                 return fileGraph;
//             } catch (error) {
//                 logger.error(`Error parsing ${filePath}:`, error);
//                 throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
//             }
//         }
//     };
// }

// function extractClassProperties(node: any): any[] {
//     const properties = [];
//     if (node.body && node.body.body) {
//         for (const member of node.body.body) {
//             if (member.type === 'ClassProperty' || member.type === 'ClassMethod') {
//                 const name = member.key && member.key.name ? member.key.name :
//                     (member.key && member.key.value ? member.key.value : 'anonymous');
//                 properties.push({
//                     name,
//                     type: member.type === 'ClassMethod' ? 'method' : 'property',
//                 });
//             }
//         }
//     }

//     return properties;
// }

// function isTopLevel(node: any, parentMap: Map<any, any>): boolean {
//     let current = node;
//     while (current && parentMap.has(current)) {
//         const parent = parentMap.get(current);
//         if (parent && parent.type === 'Program') {
//             return true;
//         }
//         if (
//             parent &&
//             (parent.type === 'FunctionDeclaration' ||
//                 parent.type === 'ArrowFunctionExpression' ||
//                 parent.type === 'FunctionExpression' ||
//                 parent.type === 'BlockStatement')
//         ) {
//             return false;
//         }
//         current = parent;
//     }
//     return false;
// }

// function inferFunctionReturnType(node: any): string[] {
//     if (node.returnType && node.returnType.typeAnnotation) {
//         const typeAnnotation = node.returnType.typeAnnotation;
//         if (typeAnnotation.type === 'TSNumberKeyword') {
//             return ['number'];
//         } else if (typeAnnotation.type === 'TSStringKeyword') {
//             return ['string'];
//         } else if (typeAnnotation.type === 'TSBooleanKeyword') {
//             return ['boolean'];
//         }
//     }
//     return [];
// }

// function inferVariableType(init: any): string | undefined {
//     if (!init) return undefined;

//     switch (init.type) {
//         case 'NumericLiteral':
//             return 'number';
//         case 'StringLiteral':
//             return 'string';
//         case 'BooleanLiteral':
//             return 'boolean';
//         case 'ObjectExpression':
//             return 'Object';
//         case 'ArrayExpression':
//             return 'Array';
//         case 'ArrowFunctionExpression':
//         case 'FunctionExpression':
//             return 'Function';
//         default:
//             return undefined;
//     }
// }

// function findFunctionCalls(functionNode: any, content: string): string[] {
//     const calls: string[] = [];
//     const importReferences = new Map(); // To track which imports are used

//     // First find all variable declarations that reference imports
//     const scopeVisitor = {
//         VariableDeclaration: (node: any) => {
//             node.declarations.forEach((decl: any) => {
//                 if (decl.id && decl.id.type === 'Identifier' &&
//                     decl.init && decl.init.type === 'Identifier') {
//                     // Track variables that reference other identifiers
//                     importReferences.set(decl.id.name, decl.init.name);
//                 }
//             });
//         }
//     };

//     // Then find all function calls
//     const callVisitor = {
//         CallExpression: (node: any) => {
//             if (node.callee.type === 'Identifier') {
//                 const calleeName = node.callee.name;
//                 // Check if this is a direct call or via a reference
//                 const actualName = importReferences.get(calleeName) || calleeName;
//                 calls.push(actualName);
//             }
//             else if (node.callee.type === 'MemberExpression' &&
//                 node.callee.property.type === 'Identifier') {
//                 // For object method calls like obj.method()
//                 if (node.callee.object.type === 'Identifier') {
//                     // If we can identify the object, use "object.method" format
//                     calls.push(`${node.callee.object.name}.${node.callee.property.name}`);
//                 } else {
//                     // Otherwise just use the method name
//                     calls.push(node.callee.property.name);
//                 }
//             }
//         }
//     };

//     // First find variables, then analyze calls to get proper context
//     if (functionNode.body) {
//         lightTraverse(functionNode.body, scopeVisitor);
//         lightTraverse(functionNode.body, callVisitor);
//     }

//     return calls;
// }

// // Helper to get variable declaration
// function getVariableDeclaration(node: any, parentMap: Map<any, any>): any {
//     let current = node;

//     while (current && parentMap.has(current)) {
//         const parent = parentMap.get(current);

//         if (parent && parent.type === 'VariableDeclarator' && parent.id) {
//             return parent;
//         }

//         current = parent;
//     }
//     return null;
// }

// function isInComponent(node: any, parentMap: Map<any, any>): boolean {
//     let current = node;
//     while (current && parentMap.has(current)) {
//         const parent = parentMap.get(current);

//         // Check if parent is a function declaration or expression
//         if (parent && (
//             parent.type === 'FunctionDeclaration' ||
//             parent.type === 'ArrowFunctionExpression' ||
//             parent.type === 'FunctionExpression'
//         )) {
//             // Check if this function might be a component (has a name starting with uppercase)
//             if (parent.id?.name && /^[A-Z]/.test(parent.id.name)) {
//                 return true;
//             }

//             // Also check variable declarator for function expressions/arrows
//             const varDecl = getVariableDeclaration(parent, parentMap);
//             if (varDecl?.id?.name && /^[A-Z]/.test(varDecl.id.name)) {
//                 return true;
//             }
//         }

//         current = parent;
//     }
//     return false;
// }
// src/parser/js-parser.js
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import path from 'path';
import { FileGraph, FileParser, FunctionGraph, TypeGraph, VariableGraph } from '../types/interfaces';
import { getStartLine, countLines, lightTraverse } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';
import { normalizePath } from '../utils/ast-utils';

export function createJsParser(): FileParser {
    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`JS Parser: parsing ${filePath}`);
            const fileGraph: FileGraph = {
                path: normalizePath(filePath),
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
                        const importedNames: any = [];

                        node.specifiers.forEach((specifier: any) => {
                            let importName;
                            if (specifier.type === 'ImportSpecifier') {
                                importName = specifier.imported.name;
                                importedNames.push(importName);
                            }
                            else if (specifier.type === 'ImportDefaultSpecifier') {
                                importName = 'default';
                                if (specifier.local && specifier.local.name) {
                                    importedNames.push(specifier.local.name);
                                }
                            }
                        });

                        // Add to file dependencies
                        const importRecord = {
                            module: source,
                            imports: importedNames.filter(Boolean)
                        };

                        fileGraph.detailedDependencies = fileGraph.detailedDependencies || [];
                        fileGraph.detailedDependencies.push(importRecord);

                        if (!fileGraph.dependencies.includes(source)) {
                            fileGraph.dependencies.push(source);
                        }

                        // Add to root function dependencies
                        const rootFn = fileGraph.functions.find(fn => fn.name === 'root');
                        if (rootFn) {
                            node.specifiers.forEach((specifier: any) => {
                                const importName = specifier.type === 'ImportSpecifier'
                                    ? specifier.imported.name
                                    : (specifier.local ? specifier.local.name : 'default');

                                if (importName) {
                                    // Using the standard dependency format
                                    rootFn.dependencies.push({ [importName]: source });
                                }
                            });
                        }
                    },
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
                        if (node.id) {
                            const name = node.id.name;
                            const startLine = getStartLine(node);

                            // For top-level functions
                            if (isTopLevel(node, parentMap)) {
                                const functionGraph: FunctionGraph = {
                                    name,
                                    referencedIn: [normalizePath(filePath)],
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
                                    callsTo: findFunctionCalls(node, content),
                                };

                                fileGraph.functions.push(functionGraph);
                            }
                            // For functions inside components (like handleClick)
                            else if (isInComponent(node, parentMap)) {
                                const functionGraph: FunctionGraph = {
                                    name,
                                    referencedIn: [normalizePath(filePath)],
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
                                    callsTo: findFunctionCalls(node, content),
                                };

                                if (!fileGraph.functions.some(fn => fn.name === name)) {
                                    fileGraph.functions.push(functionGraph);
                                }
                            }
                        }
                    },
                    VariableDeclaration: (node: any) => {
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
                                    if (declaration.init &&
                                        (declaration.init.type === 'FunctionExpression' ||
                                            declaration.init.type === 'ArrowFunctionExpression')) {
                                        const functionGraph: FunctionGraph = {
                                            name,
                                            referencedIn: [normalizePath(filePath)],
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
                                            callsTo: findFunctionCalls(declaration.init, content),
                                        };

                                        fileGraph.functions.push(functionGraph);
                                    }
                                }
                            });
                        }
                        // Also check for arrow functions inside components
                        else if (isInComponent(node, parentMap)) {
                            node.declarations.forEach((decl: any) => {
                                if (decl.id?.type === 'Identifier' &&
                                    decl.init?.type === 'ArrowFunctionExpression') {
                                    const name = decl.id.name;
                                    const startLine = getStartLine(decl.init);

                                    const functionGraph: FunctionGraph = {
                                        fileName: path.basename(filePath),
                                        name,
                                        referencedIn: [normalizePath(filePath)],
                                        startLine,
                                        length: decl.init.body ? countLines(
                                            content.substring(
                                                decl.init.body.start || 0,
                                                decl.init.body.end || content.length
                                            )
                                        ) : 0,
                                        dependencies: [],
                                        types: inferFunctionReturnType(decl.init),
                                        callsTo: findFunctionCalls(decl.init, content),
                                    };

                                    if (!fileGraph.functions.some(fn => fn.name === name)) {
                                        fileGraph.functions.push(functionGraph);
                                    }
                                }
                            });
                        }
                    },
                    ClassDeclaration: (node: any) => {
                        if (isTopLevel(node, parentMap) && node.id) {
                            const name = node.id.name;
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
                fileGraph.functions.forEach(fn => {
                    if (fn.callsTo && fn.callsTo.length > 0) {
                        // Get the set of imported function names
                        const importedFunctions = new Set();
                        const rootFn = fileGraph.functions.find(f => f.name === 'root');

                        if (rootFn && rootFn.dependencies) {
                            rootFn.dependencies.forEach(dep => {
                                const importName = Object.keys(dep)[0];
                                if (importName && importName !== 'default') {
                                    importedFunctions.add(importName);
                                }
                            });
                        }

                        // Keep both local functions and imported functions
                        fn.callsTo = fn.callsTo.filter(calledName => {
                            return fileGraph.functions.some(f => f.name === calledName) ||
                                importedFunctions.has(calledName) ||
                                calledName.includes('.'); // Keep method calls like ReactDOM.render
                        });
                    }
                });
                // Process import usages in functions
                const importedFunctionMap = new Map();
                const rootFn = fileGraph.functions.find(fn => fn.name === 'root');

                if (rootFn && rootFn.dependencies) {
                    rootFn.dependencies.forEach(dep => {
                        const importName = Object.keys(dep)[0];
                        const importSource = dep[importName];
                        if (importName) {
                            importedFunctionMap.set(importName, importSource);
                        }
                    });
                }

                // Check each function's callsTo to link imported functions
                fileGraph.functions.forEach(fn => {
                    if (fn.callsTo) {
                        // Create a dependencies array if it doesn't exist
                        fn.dependencies = fn.dependencies || [];

                        fn.callsTo.forEach(calledName => {
                            // Handle special case for ReactDOM.render
                            if (calledName === 'ReactDOM.render') {
                                fn.dependencies.push({ 'ReactDOM.render': 'react-dom' });
                            }
                            // Handle regular imported functions
                            else if (importedFunctionMap.has(calledName)) {
                                // Add the import source to function dependencies
                                const importSource = importedFunctionMap.get(calledName);
                                const depExists = fn.dependencies.some(dep =>
                                    Object.keys(dep)[0] === calledName &&
                                    Object.values(dep)[0] === importSource
                                );

                                if (!depExists) {
                                    fn.dependencies.push({ [calledName]: importSource });
                                }
                            }
                        });
                    }
                });

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
                });
            }
        }
    }

    return properties;
}

function isTopLevel(node: any, parentMap: Map<any, any>): boolean {
    let current = node;
    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);
        if (parent && parent.type === 'Program') {
            return true;
        }
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
    const importReferences = new Map(); // To track which imports are used

    // First find all variable declarations that reference imports
    const scopeVisitor = {
        VariableDeclaration: (node: any) => {
            node.declarations.forEach((decl: any) => {
                if (decl.id && decl.id.type === 'Identifier' &&
                    decl.init && decl.init.type === 'Identifier') {
                    // Track variables that reference other identifiers
                    importReferences.set(decl.id.name, decl.init.name);
                }
            });
        }
    };

    // Then find all function calls
    const callVisitor = {
        CallExpression: (node: any) => {
            if (node.callee.type === 'Identifier') {
                const calleeName = node.callee.name;
                // Check if this is a direct call or via a reference
                const actualName = importReferences.get(calleeName) || calleeName;
                calls.push(actualName);
            }
            else if (node.callee.type === 'MemberExpression' &&
                node.callee.property.type === 'Identifier') {
                // For object method calls like obj.method()
                if (node.callee.object.type === 'Identifier') {
                    // Special case for ReactDOM.render
                    if (node.callee.object.name === 'ReactDOM' &&
                        node.callee.property.name === 'render') {
                        calls.push('ReactDOM.render');
                    } else {
                        // For other object method calls
                        calls.push(`${node.callee.object.name}.${node.callee.property.name}`);
                    }
                } else {
                    // Otherwise just use the method name
                    calls.push(node.callee.property.name);
                }
            }
        }
    };

    // First find variables, then analyze calls to get proper context
    if (functionNode.body) {
        lightTraverse(functionNode.body, scopeVisitor);
        lightTraverse(functionNode.body, callVisitor);
    }

    return calls;
}

// Helper to get variable declaration
function getVariableDeclaration(node: any, parentMap: Map<any, any>): any {
    let current = node;

    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);

        if (parent && parent.type === 'VariableDeclarator' && parent.id) {
            return parent;
        }

        current = parent;
    }
    return null;
}

function isInComponent(node: any, parentMap: Map<any, any>): boolean {
    let current = node;
    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);

        // Check if parent is a function declaration or expression
        if (parent && (
            parent.type === 'FunctionDeclaration' ||
            parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression'
        )) {
            // Check if this function might be a component (has a name starting with uppercase)
            if (parent.id?.name && /^[A-Z]/.test(parent.id.name)) {
                return true;
            }

            // Also check variable declarator for function expressions/arrows
            const varDecl = getVariableDeclaration(parent, parentMap);
            if (varDecl?.id?.name && /^[A-Z]/.test(varDecl.id.name)) {
                return true;
            }
        }

        current = parent;
    }
    return false;
}
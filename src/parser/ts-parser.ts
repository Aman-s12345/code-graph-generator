
// // src/parser/ts-parser.ts
// import { parse } from '@babel/parser';
// import path from 'path';
// import { FileGraph, FileParser, TypeGraph, MemberGraph } from '../types/interfaces';
// import { getStartLine, countLines, lightTraverse, normalizePath } from '../utils/ast-utils';
// import { logger } from '../utils/file-utils';
// import { createJsParser } from './js-parser';

// export function createTsParser(): FileParser {
//     const jsParser = createJsParser();

//     return {
//         async parse(filePath: string, content: string): Promise<FileGraph> {
//             logger.debug(`TS Parser: parsing ${filePath}`);

//             // Normalize the filePath before passing to jsParser
//             const normalizedPath = normalizePath(filePath);

//             const fileGraph = await jsParser.parse(normalizedPath, content);

//             try {
//                 const ast = parse(content, {
//                     sourceType: 'module',
//                     plugins: ['typescript', 'classProperties', 'dynamicImport', 'objectRestSpread', 'optionalChaining', 'decorators-legacy'],
//                     errorRecovery: true,
//                 });

//                 extractTypeDefinitions(ast, fileGraph, normalizedPath);

//                 // Add this call to update function return types
//                 updateFunctionTypes(ast, fileGraph);

//                 return fileGraph;
//             } catch (error) {
//                 logger.warn(`TypeScript parsing failed for ${normalizedPath}, using JS parser result:`, error);
//                 return fileGraph;
//             }
//         }
//     };
// }

// // New function to update function return types from TypeScript annotations
// function updateFunctionTypes(ast: any, fileGraph: FileGraph): void {
//     const visitors = {
//         FunctionDeclaration: (node: any) => {
//             if (node.id && node.id.name && node.returnType) {
//                 const functionName = node.id.name;
//                 const func = fileGraph.functions.find(f => f.name === functionName);

//                 if (func && node.returnType) {
//                     const returnType = extractTypeAnnotation(node.returnType);
//                     if (returnType && !func.types.includes(returnType)) {
//                         func.types = [returnType]; // Replace any existing types
//                     }
//                 }
//             }
//         },

//         ExportNamedDeclaration: (node: any) => {
//             if (node.declaration && node.declaration.type === 'FunctionDeclaration') {
//                 const funcNode = node.declaration;
//                 if (funcNode.id && funcNode.id.name && funcNode.returnType) {
//                     const functionName = funcNode.id.name;
//                     const func = fileGraph.functions.find(f => f.name === functionName);

//                     if (func && funcNode.returnType) {
//                         const returnType = extractTypeAnnotation(funcNode.returnType);
//                         if (returnType && !func.types.includes(returnType)) {
//                             func.types = [returnType]; // Replace any existing types
//                         }
//                     }
//                 }
//             }
//         },

//         ArrowFunctionExpression: (node: any) => {
//             // For functions stored in variables
//             if (node.returnType) {
//                 // Need to find the variable name
//                 let current = node;
//                 let parent: any = null;
//                 // Simple traversal to find parent VariableDeclarator
//                 const varVisitor = {
//                     VariableDeclarator: (varNode: any) => {
//                         if (varNode.init === node && varNode.id && varNode.id.type === 'Identifier') {
//                             parent = varNode;
//                         }
//                     }
//                 };
//                 lightTraverse(ast, varVisitor);

//                 if (parent && parent.id && parent.id.name) {
//                     const functionName = parent.id.name;
//                     const func = fileGraph.functions.find(f => f.name === functionName);

//                     if (func) {
//                         const returnType = extractTypeAnnotation(node.returnType);
//                         if (returnType && !func.types.includes(returnType)) {
//                             func.types = [returnType]; // Replace any existing types
//                         }
//                     }
//                 }
//             }
//         }
//     };

//     lightTraverse(ast, visitors);
// }

// function extractTypeDefinitions(ast: any, fileGraph: FileGraph, filePath: string): void {
//     const visitors = {
//         TSInterfaceDeclaration: (node: any) => {
//             if (node.id && node.id.name) {
//                 const name = node.id.name;
//                 const startLine = getStartLine(node);

//                 const typeGraph: TypeGraph = {
//                     name,
//                     file: filePath,
//                     startLine,
//                     length: node.body ? (node.body.loc.end.line - node.body.loc.start.line + 1) : 0,
//                     properties: [],
//                 };

//                 if (node.body && node.body.body) {
//                     node.body.body.forEach((prop: any) => {
//                         extractTypeProperty(prop, typeGraph);
//                     });
//                 }

//                 fileGraph.types.push(typeGraph);
//             }
//         },

//         TSTypeAliasDeclaration: (node: any) => {
//             if (node.id && node.id.name) {
//                 const name = node.id.name;
//                 const startLine = getStartLine(node);

//                 const typeGraph: TypeGraph = {
//                     name,
//                     file: filePath,
//                     startLine,
//                     length: 1,
//                     properties: [],
//                 };

//                 if (node.typeAnnotation && node.typeAnnotation.type === 'TSTypeLiteral') {
//                     node.typeAnnotation.members.forEach((prop: any) => {
//                         extractTypeProperty(prop, typeGraph);
//                     });
//                 }

//                 fileGraph.types.push(typeGraph);
//             }
//         },

//         TSEnumDeclaration: (node: any) => {
//             if (node.id && node.id.name) {
//                 const name = node.id.name;
//                 const startLine = getStartLine(node);

//                 const typeGraph: TypeGraph = {
//                     name,
//                     file: filePath,
//                     startLine,
//                     length: node.members ? (node.loc.end.line - node.loc.start.line + 1) : 0,
//                     properties: [],
//                 };

//                 if (node.members) {
//                     node.members.forEach((member: any) => {
//                         if (member.id && (member.id.type === 'Identifier' || member.id.type === 'StringLiteral')) {
//                             const memberName = member.id.type === 'Identifier' ? member.id.name : member.id.value;

//                             const memberGraph: MemberGraph = {
//                                 name: memberName,
//                                 type: 'enum',
//                             };

//                             typeGraph.properties.push(memberGraph);
//                         }
//                     });
//                 }

//                 fileGraph.types.push(typeGraph);
//             }
//         }
//     };

//     lightTraverse(ast, visitors);
// }

// function extractTypeProperty(prop: any, typeGraph: TypeGraph): void {
//     if (prop.type === 'TSPropertySignature' && prop.key) {
//         const name = prop.key.name || prop.key.value;

//         const memberGraph: MemberGraph = {
//             name,
//             type: extractTypeAnnotation(prop.typeAnnotation),
//         };

//         typeGraph.properties.push(memberGraph);
//     }
//     else if (prop.type === 'TSMethodSignature' && prop.key) {
//         const name = prop.key.name || prop.key.value;

//         const parameters = prop.parameters ?
//             prop.parameters.map((param: any) => extractTypeAnnotation(param.typeAnnotation)) :
//             [];

//         const memberGraph: MemberGraph = {
//             name,
//             type: extractTypeAnnotation(prop.typeAnnotation),
//             parameters,
//         };

//         typeGraph.properties.push(memberGraph);
//     }
// }

// function extractTypeAnnotation(typeAnnotation: any): string | undefined {
//     if (!typeAnnotation) return undefined;

//     const typeNode = typeAnnotation.typeAnnotation;
//     if (!typeNode) return undefined;

//     switch (typeNode.type) {
//         case 'TSStringKeyword':
//             return 'string';
//         case 'TSNumberKeyword':
//             return 'number';
//         case 'TSBooleanKeyword':
//             return 'boolean';
//         case 'TSArrayType':
//             const elementType = extractTypeAnnotation({ typeAnnotation: typeNode.elementType });
//             return `${elementType}[]`;
//         case 'TSTypeReference':
//             if (typeNode.typeName) {
//                 return typeNode.typeName.name;
//             }
//             return 'object';
//         default:
//             return 'any';
//     }
// }
// src/parser/ts-parser.ts
import { parse } from '@babel/parser';
import path from 'path';
import { FileGraph, FileParser, TypeGraph, MemberGraph } from '../types/interfaces';
import { getStartLine, countLines, lightTraverse, normalizePath } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';
import { createJsParser } from './js-parser';

export function createTsParser(): FileParser {
    const jsParser = createJsParser();

    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`TS Parser: parsing ${filePath}`);

            // Preserve original file path but normalize slashes
            const normalizedPath = normalizePath(filePath);
            const fileGraph = await jsParser.parse(normalizedPath, content);

            try {
                const ast = parse(content, {
                    sourceType: 'module',
                    plugins: ['typescript', 'classProperties', 'dynamicImport', 'objectRestSpread', 'optionalChaining', 'decorators-legacy'],
                    errorRecovery: true,
                });

                extractTypeDefinitions(ast, fileGraph, normalizedPath);

                // Extract function return types from TypeScript annotations
                extractFunctionReturnTypes(ast, fileGraph);

                return fileGraph;
            } catch (error) {
                logger.warn(`TypeScript parsing failed for ${normalizedPath}, using JS parser result:`, error);
                return fileGraph;
            }
        }
    };
}

/**
 * Extracts return types from TypeScript functions
 */
function extractFunctionReturnTypes(ast: any, fileGraph: FileGraph): void {
    const visitors = {
        // Handle function declarations
        FunctionDeclaration: (node: any) => {
            if (node.id?.name && node.returnType?.typeAnnotation) {
                const functionName = node.id.name;
                const returnType = getTypeFromAnnotation(node.returnType.typeAnnotation);

                // Find the function in the file graph
                const func = fileGraph.functions.find(f => f.name === functionName);
                if (func && returnType) {
                    // Add the return type
                    if (!func.types) {
                        func.types = [];
                    }
                    if (!func.types.includes(returnType)) {
                        func.types = [returnType]; // Replace any existing types
                    }
                }
            }
        },

        // Handle exported function declarations
        ExportNamedDeclaration: (node: any) => {
            if (node.declaration?.type === 'FunctionDeclaration' &&
                node.declaration.id?.name &&
                node.declaration.returnType?.typeAnnotation) {

                const functionName = node.declaration.id.name;
                const returnType = getTypeFromAnnotation(node.declaration.returnType.typeAnnotation);

                // Find the function in the file graph
                const func = fileGraph.functions.find(f => f.name === functionName);
                if (func && returnType) {
                    // Add the return type
                    if (!func.types) {
                        func.types = [];
                    }
                    if (!func.types.includes(returnType)) {
                        func.types = [returnType]; // Replace existing types
                    }
                }
            }
        },

        // Handle arrow functions in variable declarations
        VariableDeclarator: (node: any) => {
            if (node.id?.type === 'Identifier' &&
                node.init?.type === 'ArrowFunctionExpression' &&
                node.init.returnType?.typeAnnotation) {

                const functionName = node.id.name;
                const returnType = getTypeFromAnnotation(node.init.returnType.typeAnnotation);

                // Find the function in the file graph
                const func = fileGraph.functions.find(f => f.name === functionName);
                if (func && returnType) {
                    // Add the return type
                    if (!func.types) {
                        func.types = [];
                    }
                    if (!func.types.includes(returnType)) {
                        func.types = [returnType]; // Replace existing types
                    }
                }
            }
        }
    };

    // Traverse the AST
    lightTraverse(ast, visitors);
}

/**
 * Gets a TypeScript type as a string from a type annotation
 */
function getTypeFromAnnotation(typeNode: any): string | undefined {
    if (!typeNode) return undefined;

    switch (typeNode.type) {
        case 'TSStringKeyword':
            return 'string';
        case 'TSNumberKeyword':
            return 'number';
        case 'TSBooleanKeyword':
            return 'boolean';
        case 'TSVoidKeyword':
            return 'void';
        case 'TSArrayType':
            const elementType = getTypeFromAnnotation(typeNode.elementType);
            return elementType ? `${elementType}[]` : undefined;
        case 'TSTypeReference':
            return typeNode.typeName?.name;
        default:
            return undefined;
    }
}

function extractTypeDefinitions(ast: any, fileGraph: FileGraph, filePath: string): void {
    const visitors = {
        TSInterfaceDeclaration: (node: any) => {
            if (node.id && node.id.name) {
                const name = node.id.name;
                const startLine = getStartLine(node);

                const typeGraph: TypeGraph = {
                    name,
                    file: filePath,
                    startLine,
                    length: node.body ? (node.body.loc.end.line - node.body.loc.start.line + 1) : 0,
                    properties: [],
                };

                if (node.body && node.body.body) {
                    node.body.body.forEach((prop: any) => {
                        extractTypeProperty(prop, typeGraph);
                    });
                }

                fileGraph.types.push(typeGraph);
            }
        },

        TSTypeAliasDeclaration: (node: any) => {
            if (node.id && node.id.name) {
                const name = node.id.name;
                const startLine = getStartLine(node);

                const typeGraph: TypeGraph = {
                    name,
                    file: filePath,
                    startLine,
                    length: 1,
                    properties: [],
                };

                if (node.typeAnnotation && node.typeAnnotation.type === 'TSTypeLiteral') {
                    node.typeAnnotation.members.forEach((prop: any) => {
                        extractTypeProperty(prop, typeGraph);
                    });
                }

                fileGraph.types.push(typeGraph);
            }
        },

        TSEnumDeclaration: (node: any) => {
            if (node.id && node.id.name) {
                const name = node.id.name;
                const startLine = getStartLine(node);

                const typeGraph: TypeGraph = {
                    name,
                    file: filePath,
                    startLine,
                    length: node.members ? (node.loc.end.line - node.loc.start.line + 1) : 0,
                    properties: [],
                };

                if (node.members) {
                    node.members.forEach((member: any) => {
                        if (member.id && (member.id.type === 'Identifier' || member.id.type === 'StringLiteral')) {
                            const memberName = member.id.type === 'Identifier' ? member.id.name : member.id.value;

                            const memberGraph: MemberGraph = {
                                name: memberName,
                                type: 'enum',
                            };

                            typeGraph.properties.push(memberGraph);
                        }
                    });
                }

                fileGraph.types.push(typeGraph);
            }
        }
    };

    lightTraverse(ast, visitors);
}

function extractTypeProperty(prop: any, typeGraph: TypeGraph): void {
    if (prop.type === 'TSPropertySignature' && prop.key) {
        const name = prop.key.name || prop.key.value;

        const memberGraph: MemberGraph = {
            name,
            type: extractTypeAnnotation(prop.typeAnnotation),
        };

        typeGraph.properties.push(memberGraph);
    }
    else if (prop.type === 'TSMethodSignature' && prop.key) {
        const name = prop.key.name || prop.key.value;

        const parameters = prop.parameters ?
            prop.parameters.map((param: any) => extractTypeAnnotation(param.typeAnnotation)) :
            [];

        const memberGraph: MemberGraph = {
            name,
            type: extractTypeAnnotation(prop.typeAnnotation),
            parameters,
        };

        typeGraph.properties.push(memberGraph);
    }
}

function extractTypeAnnotation(typeAnnotation: any): string | undefined {
    if (!typeAnnotation) return undefined;

    const typeNode = typeAnnotation.typeAnnotation;
    if (!typeNode) return undefined;

    switch (typeNode.type) {
        case 'TSStringKeyword':
            return 'string';
        case 'TSNumberKeyword':
            return 'number';
        case 'TSBooleanKeyword':
            return 'boolean';
        case 'TSArrayType':
            const elementType = extractTypeAnnotation({ typeAnnotation: typeNode.elementType });
            return `${elementType}[]`;
        case 'TSTypeReference':
            if (typeNode.typeName) {
                return typeNode.typeName.name;
            }
            return 'object';
        default:
            return 'any';
    }
}
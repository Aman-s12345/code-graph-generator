// import { parse } from '@babel/parser';
// import path from 'path';
// import { FileGraph, FileParser, FunctionGraph, VariableGraph } from '../types/interfaces';
// import { getStartLine, countLines, lightTraverse } from '../utils/ast-utils';
// import { logger } from '../utils/file-utils';
// import { createJsParser } from './js-parser';


// export function createReactParser(): FileParser {
//     const jsParser = createJsParser();

//     return {
//         async parse(filePath: string, content: string): Promise<FileGraph> {
//             logger.debug(`React Parser: parsing ${filePath}`);

//             const fileGraph = await jsParser.parse(filePath, content);

//             try {
//                 const ast = parse(content, {
//                     sourceType: 'module',
//                     plugins: [
//                         'typescript',
//                         'classProperties',
//                         'dynamicImport',
//                         ['jsx', { runtime: 'automatic', importSource: 'react' }]
//                     ] as any,
//                     errorRecovery: true,
//                 });


//                 extractReactComponents(ast, fileGraph, filePath, content);
//                 extractReactHooks(ast, fileGraph, filePath);

//                 return fileGraph;
//             } catch (error) {
//                 logger.warn(`React-specific parsing failed for ${filePath}, using JS parser result:`, error);
//                 return fileGraph;
//             }
//         }
//     };
// }

// function extractReactComponents(ast: any, fileGraph: FileGraph, filePath: string, content: string): void {

//     const isReactComponent = (node: any): boolean => {
//         if (node.body && node.body.type === 'BlockStatement') {
//             let hasJsx = false;
//             const visitor = {
//                 ReturnStatement: (returnNode: any) => {
//                     if (returnNode.argument &&
//                         (returnNode.argument.type === 'JSXElement' ||
//                             returnNode.argument.type === 'JSXFragment')) {
//                         hasJsx = true;
//                     }
//                 }
//             };

//             lightTraverse(node.body, visitor);
//             return hasJsx;
//         }

//         if (node.body &&
//             (node.body.type === 'JSXElement' ||
//                 node.body.type === 'JSXFragment')) {
//             return true;
//         }

//         return false;
//     };

//     const parentMap = new Map();
//     const buildParentMap = (node: any, parent: any) => {
//         if (node && typeof node === 'object') {
//             parentMap.set(node, parent);

//             for (const key in node) {
//                 if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
//                     const child = node[key];
//                     if (child && typeof child === 'object') {
//                         if (Array.isArray(child)) {
//                             child.forEach(item => buildParentMap(item, node));
//                         } else {
//                             buildParentMap(child, node);
//                         }
//                     }
//                 }
//             }
//         }
//     };

//     buildParentMap(ast, null);

//     const getVariableDeclaration = (node: any): any => {
//         let current = node;

//         while (current && parentMap.has(current)) {
//             const parent = parentMap.get(current);

//             if (parent && parent.type === 'VariableDeclarator' && parent.id) {
//                 return parent;
//             }

//             current = parent;
//         }

//         return null;
//     };

//     const visitors = {
//         ArrowFunctionExpression: (node: any) => {
//             if (isReactComponent(node)) {
//                 const parentDecl = getVariableDeclaration(node);
//                 if (parentDecl && parentDecl.id && parentDecl.id.type === 'Identifier') {
//                     if (isTopLevel(parentDecl, parentMap)) {
//                         const name = parentDecl.id.name;
//                         const startLine = getStartLine(node);
//                         const componentGraph: FunctionGraph = {
//                             fileName: path.basename(filePath),
//                             name: `${name} (React Component)`,
//                             referencedIn: [filePath],
//                             startLine,
//                             length: node.body ? countLines(content.substring(
//                                 node.body.start || 0,
//                                 node.body.end || content.length
//                             )) : 0,
//                             dependencies: [],
//                             types: ['React.FC'],
//                         };
//                         extractComponentProps(node, componentGraph);
//                         if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
//                             fileGraph.functions.push(componentGraph);
//                         }
//                     }

//                 }
//             }
//         },

//         FunctionDeclaration: (node: any) => {
//             if (isReactComponent(node) && node.id) {
//                 if (isTopLevel(node, parentMap)) {
//                     const name = node.id.name;
//                     const startLine = getStartLine(node);
//                     const componentGraph: FunctionGraph = {
//                         fileName: path.basename(filePath),
//                         name: `${name} (React Component)`,
//                         referencedIn: [filePath],
//                         startLine,
//                         length: node.body ? countLines(content.substring(
//                             node.body.start || 0,
//                             node.body.end || content.length
//                         )) : 0,
//                         dependencies: [],
//                         types: ['React.FC'],
//                     };
//                     extractComponentProps(node, componentGraph);
//                     if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
//                         fileGraph.functions.push(componentGraph);
//                     }
//                 }

//             }
//         },
//         VariableDeclaration: (node: any) => {
//             if (isTopLevel(node, parentMap)) {
//                 node.declarations.forEach((decl: any) => {
//                     if (decl.init &&
//                         (decl.init.type === 'FunctionExpression' ||
//                             decl.init.type === 'ArrowFunctionExpression') &&
//                         isReactComponent(decl.init) &&
//                         decl.id &&
//                         decl.id.type === 'Identifier') {

//                         const name = decl.id.name;
//                         const startLine = getStartLine(decl.init);

//                         const componentGraph: FunctionGraph = {
//                             fileName: path.basename(filePath),
//                             name: `${name} (React Component)`,
//                             referencedIn: [filePath],
//                             startLine,
//                             length: decl.init.body ? countLines(content.substring(
//                                 decl.init.body.start || 0,
//                                 decl.init.body.end || content.length
//                             )) : 0,
//                             dependencies: [],
//                             types: ['React.FC'],
//                         };
//                         extractComponentProps(decl.init, componentGraph);
//                         if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
//                             fileGraph.functions.push(componentGraph);
//                         }
//                     }
//                 });
//             }

//         }
//     };

//     lightTraverse(ast, visitors);
//     const componentHierarchy = buildComponentHierarchy(ast, fileGraph);
//     fileGraph.componentHierarchy = componentHierarchy;
// }

// function extractComponentProps(node: any, component: FunctionGraph): void {
//     if (node.params && node.params.length > 0) {
//         const propsParam = node.params[0];

//         if (propsParam.type === 'ObjectPattern' && propsParam.properties) {
//             propsParam.properties.forEach((prop: any) => {
//                 if (prop.key && prop.key.name) {
//                     component.dependencies.push({ [`prop:${prop.key.name}`]: 'component-props' });
//                 }
//             });
//         }
//         else if (propsParam.type === 'Identifier' && propsParam.typeAnnotation) {
//             component.dependencies.push({ ['props']: 'component-props' });

//             if (propsParam.typeAnnotation.typeAnnotation &&
//                 propsParam.typeAnnotation.typeAnnotation.type === 'TSTypeReference' &&
//                 propsParam.typeAnnotation.typeAnnotation.typeName) {
//                 const typeName = propsParam.typeAnnotation.typeAnnotation.typeName.name;
//                 component.types.push(`Props: ${typeName}`);
//             }
//         }
//         else if (propsParam.type === 'Identifier') {
//             component.dependencies.push({ ['props']: 'component-props' });
//         }
//     }
// }

// function extractReactHooks(ast: any, fileGraph: FileGraph, filePath: string): void {
//     const hookVariables: Record<string, string[]> = {};
//     const parentMap = new Map();
//     const buildParentMap = (node: any, parent: any) => {
//         if (node && typeof node === 'object') {
//             parentMap.set(node, parent);

//             for (const key in node) {
//                 if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
//                     const child = node[key];
//                     if (child && typeof child === 'object') {
//                         if (Array.isArray(child)) {
//                             child.forEach(item => buildParentMap(item, node));
//                         } else {
//                             buildParentMap(child, node);
//                         }
//                     }
//                 }
//             }
//         }
//     };

//     buildParentMap(ast, null);
//     const visitors = {
//         VariableDeclaration: (node: any) => {
//             if (isTopLevel(node, parentMap)) {
//                 node.declarations.forEach((decl: any) => {
//                     if (decl.id && decl.id.type === 'ArrayPattern' &&
//                         decl.init && decl.init.type === 'CallExpression' &&
//                         decl.init.callee && decl.init.callee.type === 'Identifier') {

//                         const hookName = decl.init.callee.name;

//                         if (hookName === 'useState') {
//                             if (decl.id.elements && decl.id.elements.length >= 2) {
//                                 const stateVar = decl.id.elements[0];
//                                 const setterVar = decl.id.elements[1];

//                                 if (stateVar && stateVar.type === 'Identifier') {
//                                     const varName = stateVar.name;

//                                     const stateVarGraph: VariableGraph = {
//                                         name: `${varName} (State)`,
//                                         type: 'State',
//                                         dependencies: [{ 'useState': 'react' }]
//                                     };

//                                     fileGraph.variables.push(stateVarGraph);

//                                     if (setterVar && setterVar.type === 'Identifier') {
//                                         const setterName = setterVar.name;
//                                         hookVariables[varName] = [setterName];

//                                         const setterVarGraph: VariableGraph = {
//                                             name: `${setterName} (State Setter)`,
//                                             type: 'StateSetter',
//                                             dependencies: [{ [varName]: 'state-var' }]
//                                         };

//                                         fileGraph.variables.push(setterVarGraph);
//                                     }
//                                 }
//                             }
//                         }
//                         else if (hookName === 'useEffect') {
//                             if (decl.init.arguments && decl.init.arguments.length >= 2) {
//                                 const depsArray = decl.init.arguments[1];
//                                 if (depsArray.type === 'ArrayExpression' && depsArray.elements) {
//                                     depsArray.elements.forEach((elem: any) => {
//                                         if (elem.type === 'Identifier') {
//                                             const depName = elem.name;
//                                             if (!hookVariables[depName]) {
//                                                 hookVariables[depName] = [];
//                                             }
//                                             hookVariables[depName].push('useEffect');
//                                         }
//                                     });
//                                 }
//                             }
//                         }
//                         else if (hookName.startsWith('use')) {
//                             if (decl.id.elements) {
//                                 decl.id.elements.forEach((elem: any) => {
//                                     if (elem && elem.type === 'Identifier') {
//                                         const varName = elem.name;
//                                         const hookVarGraph: VariableGraph = {
//                                             name: `${varName} (${hookName} result)`,
//                                             type: 'Hook',
//                                             dependencies: [{ [hookName]: 'react/custom-hook' }]
//                                         };

//                                         fileGraph.variables.push(hookVarGraph);
//                                     }
//                                 });
//                             }
//                         }
//                     }
//                 });

//             }


//         }
//     };

//     lightTraverse(ast, visitors);
// }

// // Helper function to check if a node is at the top level
// function isTopLevel(node: any, parentMap: Map<any, any>): boolean {
//     let current = node;
//     while (current && parentMap.has(current)) {
//         const parent = parentMap.get(current);
//         // If we reach the Program node directly, it's top level
//         if (parent && parent.type === 'Program') {
//             return true;
//         }

//         // If we reach a FunctionDeclaration or other scope creator,
//         // and it's not directly under Program, it's not top level
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

// // In your react-parser.ts

// function buildComponentHierarchy(ast: any, fileGraph: FileGraph): any {
//     const components: Record<string, { renders: string[] }> = {};

//     // Collect components defined in this file
//     fileGraph.functions.forEach(fn => {
//         if (fn.name.includes('React Component')) {
//             const baseName = fn.name.replace(' (React Component)', '');
//             components[baseName] = { renders: [] };
//         }
//     });

//     // Create a parent map for finding containing functions
//     const parentMap = new Map();
//     const buildParentMap = (node: any, parent: any) => {
//         if (node && typeof node === 'object') {
//             parentMap.set(node, parent);

//             for (const key in node) {
//                 if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
//                     const child = node[key];
//                     if (child && typeof child === 'object') {
//                         if (Array.isArray(child)) {
//                             child.forEach(item => buildParentMap(item, node));
//                         } else {
//                             buildParentMap(child, node);
//                         }
//                     }
//                 }
//             }
//         }
//     };

//     buildParentMap(ast, null);

//     // Helper function to find containing component
//     function findComponentFromNode(node: any): string | null {
//         let current = node;
//         let functionNode = null;

//         // First find the closest function
//         while (current && parentMap.has(current)) {
//             if (current.type === 'ArrowFunctionExpression' || 
//                 current.type === 'FunctionExpression' || 
//                 current.type === 'FunctionDeclaration') {
//                 functionNode = current;
//                 break;
//             }
//             current = parentMap.get(current);
//         }

//         if (!functionNode) return null;

//         // For function declarations
//         if (functionNode.type === 'FunctionDeclaration' && functionNode.id) {
//             return functionNode.id.name;
//         }

//         // For function expressions, find the variable they're assigned to
//         current = functionNode;
//         while (current && parentMap.has(current)) {
//             const parent = parentMap.get(current);
//             if (parent && parent.type === 'VariableDeclarator' && parent.id) {
//                 return parent.id.name;
//             }
//             current = parent;
//         }

//         return null;
//     }

//     // Enhanced visitors
//     const visitors = {
//         JSXIdentifier: (node: any) => {
//             // Only look at element names, not attributes
//             const parent = parentMap.get(node);
//             if (!parent || parent.type !== 'JSXOpeningElement') return;

//             // Check if this is a component name (starts with capital letter)
//             if (node.name && node.name[0] === node.name[0].toUpperCase()) {
//                 // Find containing component
//                 const componentName = findComponentFromNode(node);

//                 if (componentName && components[componentName]) {
//                     // Don't add duplicates
//                     if (!components[componentName].renders.includes(node.name)) {
//                         components[componentName].renders.push(node.name);
//                     }
//                 }
//             }
//         }
//     };

//     // Use lightweight traversal instead of ancestor tracking
//     lightTraverse(ast, visitors);

//     return components;
// }

// function findContainingComponent(ancestors: any[]): string | null {
//     // Walk up the ancestor chain to find a function declaration or expression
//     for (let i = ancestors.length - 1; i >= 0; i--) {
//         const node = ancestors[i];

//         // Case 1: Named function declaration
//         if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
//             return node.id.name;
//         }

//         // Case 2: Variable declaration with function expression
//         if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
//             return node.id.name;
//         }

//         // Case 3: Arrow function or function expression assigned to variable
//         if ((node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')) {
//             // Look for parent variable declarator
//             for (let j = i - 1; j >= 0; j--) {
//                 const parent = ancestors[j];
//                 if (parent.type === 'VariableDeclarator' && parent.id && parent.id.type === 'Identifier') {
//                     return parent.id.name;
//                 }
//             }
//         }
//     }
//     return null;
// }

// // Modified traversal function that tracks ancestors
// function traverseWithAncestors(
//     node: any,
//     visitors: Record<string, (node: any, ancestors: any[]) => void>,
//     ancestors: any[] = []
// ): void {
//     if (!node || typeof node !== 'object') return;

//     const newAncestors = [...ancestors, node];

//     // Call the appropriate visitor if available
//     if (node.type && visitors[node.type]) {
//         visitors[node.type](node, newAncestors);
//     }

//     // Recursively visit all properties
//     for (const key of Object.keys(node)) {
//         const child = node[key];

//         // Skip non-object properties and specific fields
//         if (key === 'loc' || key === 'range' || key === 'parent' ||
//             !child || typeof child !== 'object') continue;

//         if (Array.isArray(child)) {
//             for (const item of child) {
//                 traverseWithAncestors(item, visitors, newAncestors);
//             }
//         } else {
//             traverseWithAncestors(child, visitors, newAncestors);
//         }
//     }
// }

// function enhanceComponentHierarchy(hierarchy: Record<string, { renders: string[] }>): Record<string, { renders: string[], renderedBy: string[] }> {
//     const enhanced: Record<string, { renders: string[], renderedBy: string[] }> = {};

//     // Initialize with existing renders data
//     Object.keys(hierarchy).forEach(component => {
//         enhanced[component] = {
//             renders: [...hierarchy[component].renders],
//             renderedBy: []
//         };
//     });

//     // Calculate renderedBy relationships
//     Object.keys(enhanced).forEach(component => {
//         const renderedComponents = enhanced[component].renders;

//         renderedComponents.forEach(rendered => {
//             // If the rendered component is in our hierarchy, update its renderedBy
//             if (enhanced[rendered]) {
//                 if (!enhanced[rendered].renderedBy.includes(component)) {
//                     enhanced[rendered].renderedBy.push(component);
//                 }
//             } else {
//                 // Create an entry for external components
//                 enhanced[rendered] = {
//                     renders: [],
//                     renderedBy: [component]
//                 };
//             }
//         });
//     });

//     return enhanced;
// }

import { parse } from '@babel/parser';
import path from 'path';
import { FileGraph, FileParser, FunctionGraph, VariableGraph } from '../types/interfaces';
import { getStartLine, countLines, lightTraverse } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';
import { createJsParser } from './js-parser';


export function createReactParser(): FileParser {
    const jsParser = createJsParser();

    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`React Parser: parsing ${filePath}`);

            const fileGraph = await jsParser.parse(filePath, content);

            try {
                const ast = parse(content, {
                    sourceType: 'module',
                    plugins: [
                        'typescript',
                        'classProperties',
                        'dynamicImport',
                        ['jsx', { runtime: 'automatic', importSource: 'react' }]
                    ] as any,
                    errorRecovery: true,
                });

                // Track React imports specifically
                extractReactImports(ast, fileGraph);
                extractReactComponents(ast, fileGraph, filePath, content);
                extractReactHooks(ast, fileGraph, filePath);

                return fileGraph;
            } catch (error) {
                logger.warn(`React-specific parsing failed for ${filePath}, using JS parser result:`, error);
                return fileGraph;
            }
        }
    };
}

// New function to better track React-specific imports
function extractReactImports(ast: any, fileGraph: FileGraph): void {
    const visitors = {
        ImportDeclaration: (node: any) => {
            const source = node.source.value;

            // Track React-specific imports
            if (source === 'react' || source.startsWith('react-')) {
                const importNames: string[] = [];

                node.specifiers.forEach((specifier: any) => {
                    // Handle default import (import React from 'react')
                    if (specifier.type === 'ImportDefaultSpecifier') {
                        importNames.push('default');
                    }
                    // Handle named imports (import { useState } from 'react')
                    else if (specifier.type === 'ImportSpecifier') {
                        if (specifier.imported && specifier.imported.name) {
                            importNames.push(specifier.imported.name);
                        }
                    }
                });

                // Add or update detailed dependencies
                fileGraph.detailedDependencies = fileGraph.detailedDependencies || [];
                const existingDep = fileGraph.detailedDependencies.find(dep => dep.module === source);

                if (existingDep) {
                    existingDep.imports = [...new Set([...existingDep.imports, ...importNames])];
                } else {
                    fileGraph.detailedDependencies.push({
                        module: source,
                        imports: importNames
                    });
                }
            }
        }
    };

    lightTraverse(ast, visitors);
}

function extractReactComponents(ast: any, fileGraph: FileGraph, filePath: string, content: string): void {

    const isReactComponent = (node: any): boolean => {
        if (node.body && node.body.type === 'BlockStatement') {
            let hasJsx = false;
            const visitor = {
                ReturnStatement: (returnNode: any) => {
                    if (returnNode.argument &&
                        (returnNode.argument.type === 'JSXElement' ||
                            returnNode.argument.type === 'JSXFragment')) {
                        hasJsx = true;
                    }
                }
            };

            lightTraverse(node.body, visitor);
            return hasJsx;
        }

        if (node.body &&
            (node.body.type === 'JSXElement' ||
                node.body.type === 'JSXFragment')) {
            return true;
        }

        return false;
    };

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

    const getVariableDeclaration = (node: any): any => {
        let current = node;

        while (current && parentMap.has(current)) {
            const parent = parentMap.get(current);

            if (parent && parent.type === 'VariableDeclarator' && parent.id) {
                return parent;
            }

            current = parent;
        }

        return null;
    };

    // Keep track of component names to avoid duplication in component hierarchy
    const componentNames = new Set<string>();

    const visitors = {
        ArrowFunctionExpression: (node: any) => {
            if (isReactComponent(node)) {
                const parentDecl = getVariableDeclaration(node);
                if (parentDecl && parentDecl.id && parentDecl.id.type === 'Identifier') {
                    if (isTopLevel(parentDecl, parentMap)) {
                        const name = parentDecl.id.name;
                        const startLine = getStartLine(node);
                        const componentGraph: FunctionGraph = {
                            fileName: path.basename(filePath),
                            name: `${name} (React Component)`,
                            referencedIn: [filePath],
                            startLine,
                            length: node.body ? countLines(content.substring(
                                node.body.start || 0,
                                node.body.end || content.length
                            )) : 0,
                            dependencies: [],
                            types: ['React.FC'],
                        };
                        extractComponentProps(node, componentGraph);
                        if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
                            fileGraph.functions.push(componentGraph);
                            componentNames.add(name); // Track component name for hierarchy
                        }
                    }
                }
            }
        },

        FunctionDeclaration: (node: any) => {
            if (isReactComponent(node) && node.id) {
                if (isTopLevel(node, parentMap)) {
                    const name = node.id.name;
                    const startLine = getStartLine(node);
                    const componentGraph: FunctionGraph = {
                        fileName: path.basename(filePath),
                        name: `${name} (React Component)`,
                        referencedIn: [filePath],
                        startLine,
                        length: node.body ? countLines(content.substring(
                            node.body.start || 0,
                            node.body.end || content.length
                        )) : 0,
                        dependencies: [],
                        types: ['React.FC'],
                    };
                    extractComponentProps(node, componentGraph);
                    if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
                        fileGraph.functions.push(componentGraph);
                        componentNames.add(name); // Track component name for hierarchy
                    }
                }
            }
        },
        VariableDeclaration: (node: any) => {
            if (isTopLevel(node, parentMap)) {
                node.declarations.forEach((decl: any) => {
                    if (decl.init &&
                        (decl.init.type === 'FunctionExpression' ||
                            decl.init.type === 'ArrowFunctionExpression') &&
                        isReactComponent(decl.init) &&
                        decl.id &&
                        decl.id.type === 'Identifier') {

                        const name = decl.id.name;
                        const startLine = getStartLine(decl.init);

                        const componentGraph: FunctionGraph = {
                            fileName: path.basename(filePath),
                            name: `${name} (React Component)`,
                            referencedIn: [filePath],
                            startLine,
                            length: decl.init.body ? countLines(content.substring(
                                decl.init.body.start || 0,
                                decl.init.body.end || content.length
                            )) : 0,
                            dependencies: [],
                            types: ['React.FC'],
                        };
                        extractComponentProps(decl.init, componentGraph);
                        if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
                            fileGraph.functions.push(componentGraph);
                            componentNames.add(name); // Track component name for hierarchy
                        }
                    }
                });
            }
        }
    };

    lightTraverse(ast, visitors);

    // Build component hierarchy with the tracked component names
    const componentHierarchy = buildComponentHierarchy(ast, fileGraph, componentNames, parentMap);
    fileGraph.componentHierarchy = componentHierarchy;
}

function extractComponentProps(node: any, component: FunctionGraph): void {
    if (node.params && node.params.length > 0) {
        const propsParam = node.params[0];

        if (propsParam.type === 'ObjectPattern' && propsParam.properties) {
            propsParam.properties.forEach((prop: any) => {
                if (prop.key && prop.key.name) {
                    component.dependencies.push({ [`prop:${prop.key.name}`]: 'component-props' });
                }
            });
        }
        else if (propsParam.type === 'Identifier' && propsParam.typeAnnotation) {
            component.dependencies.push({ ['props']: 'component-props' });

            if (propsParam.typeAnnotation.typeAnnotation &&
                propsParam.typeAnnotation.typeAnnotation.type === 'TSTypeReference' &&
                propsParam.typeAnnotation.typeAnnotation.typeName) {
                const typeName = propsParam.typeAnnotation.typeAnnotation.typeName.name;
                component.types.push(`Props: ${typeName}`);
            }
        }
        else if (propsParam.type === 'Identifier') {
            component.dependencies.push({ ['props']: 'component-props' });
        }
    }
}

function extractReactHooks(ast: any, fileGraph: FileGraph, filePath: string): void {
    const hookVariables: Record<string, string[]> = {};
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

    // Track hooks directly
    const hooksUsed = new Set<string>();

    const visitors = {
        CallExpression: (node: any) => {
            // Check for React hooks (functions that start with 'use')
            if (node.callee &&
                node.callee.type === 'Identifier' &&
                node.callee.name.startsWith('use')) {

                // Add to hooks used
                hooksUsed.add(node.callee.name);
            }
        },

        VariableDeclaration: (node: any) => {
            // Only process variable declarations in function components
            // (hooks must be called at the top level of components)
            const isInComponent = isInFunctionComponent(node, parentMap);

            if (isInComponent) {
                node.declarations.forEach((decl: any) => {
                    if (decl.id && decl.id.type === 'ArrayPattern' &&
                        decl.init && decl.init.type === 'CallExpression' &&
                        decl.init.callee && decl.init.callee.type === 'Identifier') {

                        const hookName = decl.init.callee.name;

                        // Add hook to tracked hooks
                        hooksUsed.add(hookName);

                        if (hookName === 'useState') {
                            if (decl.id.elements && decl.id.elements.length >= 2) {
                                const stateVar = decl.id.elements[0];
                                const setterVar = decl.id.elements[1];

                                if (stateVar && stateVar.type === 'Identifier') {
                                    const varName = stateVar.name;

                                    const stateVarGraph: VariableGraph = {
                                        name: `${varName} (State)`,
                                        type: 'State',
                                        dependencies: [{ 'useState': 'react' }]
                                    };

                                    // Avoid duplication
                                    if (!fileGraph.variables.some(v => v.name === stateVarGraph.name)) {
                                        fileGraph.variables.push(stateVarGraph);
                                    }

                                    if (setterVar && setterVar.type === 'Identifier') {
                                        const setterName = setterVar.name;
                                        hookVariables[varName] = [setterName];

                                        const setterVarGraph: VariableGraph = {
                                            name: `${setterName} (State Setter)`,
                                            type: 'StateSetter',
                                            dependencies: [{ [varName]: 'state-var' }]
                                        };

                                        // Avoid duplication
                                        if (!fileGraph.variables.some(v => v.name === setterVarGraph.name)) {
                                            fileGraph.variables.push(setterVarGraph);
                                        }
                                    }
                                }
                            }
                        }
                        else if (hookName === 'useEffect') {
                            if (decl.init.arguments && decl.init.arguments.length >= 2) {
                                const depsArray = decl.init.arguments[1];
                                if (depsArray.type === 'ArrayExpression' && depsArray.elements) {
                                    depsArray.elements.forEach((elem: any) => {
                                        if (elem.type === 'Identifier') {
                                            const depName = elem.name;
                                            if (!hookVariables[depName]) {
                                                hookVariables[depName] = [];
                                            }
                                            hookVariables[depName].push('useEffect');
                                        }
                                    });
                                }
                            }
                        }
                        else if (hookName.startsWith('use')) {
                            if (decl.id.elements) {
                                decl.id.elements.forEach((elem: any) => {
                                    if (elem && elem.type === 'Identifier') {
                                        const varName = elem.name;
                                        const hookVarGraph: VariableGraph = {
                                            name: `${varName} (${hookName} result)`,
                                            type: 'Hook',
                                            dependencies: [{ [hookName]: 'react/custom-hook' }]
                                        };

                                        // Avoid duplication
                                        if (!fileGraph.variables.some(v => v.name === hookVarGraph.name)) {
                                            fileGraph.variables.push(hookVarGraph);
                                        }
                                    }
                                });
                            }
                        }
                    }
                });
            }
        }
    };

    lightTraverse(ast, visitors);

    // Add the hooks used as variables
    hooksUsed.forEach(hookName => {
        const hookVar: VariableGraph = {
            name: hookName,
            type: 'React Hook',
            dependencies: [{ 'react': 'module' }]
        };

        // Avoid duplication
        if (!fileGraph.variables.some(v => v.name === hookVar.name)) {
            fileGraph.variables.push(hookVar);
        }
    });
}

// New helper function to check if a node is inside a React component
function isInFunctionComponent(node: any, parentMap: Map<any, any>): boolean {
    let current = node;

    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);

        // If we reach a function that returns JSX, it's a component
        if ((parent.type === 'FunctionDeclaration' ||
            parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression') &&
            parent.body && parent.body.type === 'BlockStatement') {

            // Check if this function returns JSX
            let hasJsx = false;
            const visitor = {
                ReturnStatement: (returnNode: any) => {
                    if (returnNode.argument &&
                        (returnNode.argument.type === 'JSXElement' ||
                            returnNode.argument.type === 'JSXFragment')) {
                        hasJsx = true;
                    }
                }
            };

            lightTraverse(parent.body, visitor);
            return hasJsx;
        }

        current = parent;
    }

    return false;
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

// Improved component hierarchy builder
function buildComponentHierarchy(
    ast: any,
    fileGraph: FileGraph,
    componentNames: Set<string>,
    parentMap: Map<any, any>
): Record<string, { renders: string[], renderedBy: string[] }> {
    const componentHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};

    // Initialize hierarchy for all components
    componentNames.forEach(name => {
        componentHierarchy[name] = {
            renders: [],
            renderedBy: []
        };
    });

    // Function to find containing component function for a JSX element
    const findContainingComponent = (node: any): string | null => {
        let current = node;

        while (current && parentMap.has(current)) {
            const parent = parentMap.get(current);

            // Check if it's a function or arrow function
            if ((parent.type === 'FunctionDeclaration' ||
                parent.type === 'ArrowFunctionExpression' ||
                parent.type === 'FunctionExpression') &&
                isReactComponent(parent)) {

                // Get function name
                let name = null;

                if (parent.type === 'FunctionDeclaration' && parent.id) {
                    name = parent.id.name;
                } else {
                    // For arrow functions and function expressions, find variable declaration
                    const varDecl = getVariableDeclaration(parent, parentMap);
                    if (varDecl && varDecl.id && varDecl.id.type === 'Identifier') {
                        name = varDecl.id.name;
                    }
                }

                return name;
            }

            current = parent;
        }

        return null;
    };

    // Helper to get variable declaration
    const getVariableDeclaration = (node: any, parentMap: Map<any, any>): any => {
        let current = node;

        while (current && parentMap.has(current)) {
            const parent = parentMap.get(current);

            if (parent && parent.type === 'VariableDeclarator' && parent.id) {
                return parent;
            }

            current = parent;
        }

        return null;
    };

    // Check if a node is a React component
    const isReactComponent = (node: any): boolean => {
        if (node.body && node.body.type === 'BlockStatement') {
            let hasJsx = false;
            const visitor = {
                ReturnStatement: (returnNode: any) => {
                    if (returnNode.argument &&
                        (returnNode.argument.type === 'JSXElement' ||
                            returnNode.argument.type === 'JSXFragment')) {
                        hasJsx = true;
                    }
                }
            };

            lightTraverse(node.body, visitor);
            return hasJsx;
        }

        if (node.body &&
            (node.body.type === 'JSXElement' ||
                node.body.type === 'JSXFragment')) {
            return true;
        }

        return false;
    };

    // Find JSX elements and track relationships
    const visitors = {
        JSXElement: (node: any) => {
            if (node.openingElement && node.openingElement.name) {
                const elementName =
                    node.openingElement.name.type === 'JSXIdentifier'
                        ? node.openingElement.name.name
                        : null;

                // Only process component references (capitalized names)
                if (elementName && elementName[0] === elementName[0].toUpperCase()) {
                    // Find which component contains this JSX
                    const parentComponent = findContainingComponent(node);

                    if (parentComponent && componentHierarchy[parentComponent]) {
                        // Add element as rendered by this component
                        if (!componentHierarchy[parentComponent].renders.includes(elementName)) {
                            componentHierarchy[parentComponent].renders.push(elementName);
                        }

                        // Update rendered-by relationship if element is a tracked component
                        if (componentHierarchy[elementName]) {
                            if (!componentHierarchy[elementName].renderedBy.includes(parentComponent)) {
                                componentHierarchy[elementName].renderedBy.push(parentComponent);
                            }
                        }
                    }
                }
            }
        }
    };

    // Traverse the AST to find all JSX elements
    lightTraverse(ast, visitors);

    return componentHierarchy;
}

// fixed traverseWithAncestors function
function traverseWithAncestors(
    node: any,
    visitors: Record<string, (node: any, ancestors: any[]) => void>,
    ancestors: any[] = []
): void {
    if (!node || typeof node !== 'object') return;

    const newAncestors = [...ancestors, node];

    // Call the appropriate visitor if available
    if (node.type && visitors[node.type]) {
        visitors[node.type](node, newAncestors);
    }

    // Recursively visit all properties
    for (const key of Object.keys(node)) {
        const child = node[key];

        // Skip non-object properties and AST metadata
        if (key === 'loc' || key === 'range' || key === 'parent' ||
            !child || typeof child !== 'object') continue;

        if (Array.isArray(child)) {
            for (const item of child) {
                traverseWithAncestors(item, visitors, newAncestors);
            }
        } else {
            traverseWithAncestors(child, visitors, newAncestors);
        }
    }
}

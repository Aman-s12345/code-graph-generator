// // src/parser/react-parser.js
// import { parse } from '@babel/parser';
// import path from 'path';
// import { FileGraph, FileParser, FunctionGraph, VariableGraph } from '../types/interfaces';
// import { getStartLine, countLines, lightTraverse, normalizePath } from '../utils/ast-utils';
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
//                 extractReactImports(ast, fileGraph);
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

// function extractReactImports(ast: any, fileGraph: FileGraph): void {
//     const visitors = {
//         ImportDeclaration: (node: any) => {
//             const source = node.source.value;

//             // Process all imports, not just react ones
//             const importNames: string[] = [];
//             node.specifiers.forEach((specifier: any) => {
//                 if (specifier.type === 'ImportDefaultSpecifier') {
//                     importNames.push('default');
//                 }
//                 else if (specifier.type === 'ImportSpecifier') {
//                     if (specifier.imported && specifier.imported.name) {
//                         importNames.push(specifier.imported.name);
//                     } else if (specifier.local && specifier.local.name) {
//                         // Handle the case where imported name might not be available
//                         importNames.push(specifier.local.name);
//                     }
//                 }
//             });

//             fileGraph.detailedDependencies = fileGraph.detailedDependencies || [];
//             const existingDep = fileGraph.detailedDependencies.find(dep => dep.module === source);
//             if (existingDep) {
//                 existingDep.imports = [...new Set([...existingDep.imports, ...importNames])];
//             } else {
//                 fileGraph.detailedDependencies.push({
//                     module: source,
//                     imports: importNames
//                 });
//             }
//         }
//     };

//     lightTraverse(ast, visitors);
// }

// function extractReactComponents(ast: any, fileGraph: FileGraph, filePath: string, content: string): void {
//     const isReactComponent = (node: any): boolean => {
//         if (node.body && node.body.type === 'BlockStatement') {
//             let hasJsx = false;
//             let usesHooks = false;
//             const visitor = {
//                 ReturnStatement: (returnNode: any) => {
//                     if (returnNode.argument &&
//                         (returnNode.argument.type === 'JSXElement' ||
//                             returnNode.argument.type === 'JSXFragment')) {
//                         hasJsx = true;
//                     }
//                 },
//                 CallExpression: (callNode: any) => {
//                     if (callNode.callee &&
//                         callNode.callee.type === 'Identifier' &&
//                         callNode.callee.name.startsWith('use')) {
//                         usesHooks = true;
//                     }
//                 }
//             };
//             lightTraverse(node.body, visitor);
//             return hasJsx || usesHooks;
//         }
//         if (node.body &&
//             (node.body.type === 'JSXElement' ||
//                 node.body.type === 'JSXFragment')) {
//             return true;
//         }
//         return false;
//     };

//     const parentMap = new Map();
//     buildParentMap(ast, null, parentMap);

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

//     const componentNames = new Set<string>();
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
//                             referencedIn: [normalizePath(filePath)],
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
//                             componentNames.add(name); // Track component name for hierarchy
//                         }
//                     }
//                 }
//             }
//         },

//         FunctionDeclaration: (node: any) => {
//             if (node.id) {
//                 const name = node.id.name;
//                 const startLine = getStartLine(node);

//                 // For component functions (top-level or nested)
//                 if (isReactComponent(node)) {
//                     // Top-level components get both regular and component versions
//                     if (isTopLevel(node, parentMap)) {
//                         // Add regular function version
//                         if (!fileGraph.functions.some(fn => fn.name === name)) {
//                             const regularFunction: FunctionGraph = {
//                                 fileName: path.basename(filePath),
//                                 name: name,
//                                 referencedIn: [normalizePath(filePath)],
//                                 startLine,
//                                 length: node.body ? countLines(content.substring(
//                                     node.body.start || 0,
//                                     node.body.end || content.length
//                                 )) : 0,
//                                 dependencies: [],
//                                 types: [],
//                             };
//                             fileGraph.functions.push(regularFunction);
//                         }

//                         // Add React component version
//                         const componentGraph: FunctionGraph = {
//                             fileName: path.basename(filePath),
//                             name: `${name} (React Component)`,
//                             referencedIn: [normalizePath(filePath)],
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
//                             componentNames.add(name); // Track component name for hierarchy
//                         }
//                     }
//                 }
//                 // For nested functions like handleClick
//                 else if (!isTopLevel(node, parentMap) && isInComponent(node, parentMap)) {
//                     const functionGraph: FunctionGraph = {
//                         fileName: path.basename(filePath),
//                         name,
//                         referencedIn: [normalizePath(filePath)],
//                         startLine,
//                         length: node.body ? countLines(content.substring(
//                             node.body.start || 0,
//                             node.body.end || content.length
//                         )) : 0,
//                         dependencies: [],
//                         types: inferFunctionReturnType(node),
//                         callsTo: findFunctionCalls(node, content, ast),
//                     };

//                     if (!fileGraph.functions.some(fn => fn.name === name)) {
//                         fileGraph.functions.push(functionGraph);
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
//                             referencedIn: [normalizePath(filePath)],
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
//                             componentNames.add(name); // Track component name for hierarchy
//                         }
//                     }
//                 });
//             }
//             // Also check for arrow functions inside components
//             else if (isInComponent(node, parentMap)) {
//                 node.declarations.forEach((decl: any) => {
//                     if (decl.id?.type === 'Identifier' &&
//                         decl.init?.type === 'ArrowFunctionExpression') {
//                         const name = decl.id.name;
//                         const startLine = getStartLine(decl.init);

//                         const functionGraph: FunctionGraph = {
//                             fileName: path.basename(filePath),
//                             name,
//                             referencedIn: [normalizePath(filePath)],
//                             startLine,
//                             length: decl.init.body ? countLines(content.substring(
//                                 decl.init.body.start || 0,
//                                 decl.init.body.end || content.length
//                             )) : 0,
//                             dependencies: [],
//                             types: inferFunctionReturnType(decl.init),
//                             callsTo: findFunctionCalls(decl.init, content, ast),
//                         };

//                         if (!fileGraph.functions.some(fn => fn.name === name)) {
//                             fileGraph.functions.push(functionGraph);
//                         }
//                     }
//                 });
//             }
//         }
//     };

//     lightTraverse(ast, visitors);

//     // Build component hierarchy with the tracked component names
//     if (componentNames.size > 0) {
//         const componentHierarchy = buildComponentHierarchy(ast, fileGraph, componentNames, parentMap);
//         fileGraph.componentHierarchy = componentHierarchy;
//     } else {
//         // If no components were found but file has JSX extension, check for unnamed/inline components
//         if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
//             const functionNames = fileGraph.functions
//                 .filter(fn => fn.name !== 'root')
//                 .map(fn => fn.name.replace(' (React Component)', ''));

//             // Create a default hierarchy for any named functions that might be components
//             if (functionNames.length > 0) {
//                 const defaultHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};
//                 functionNames.forEach(name => {
//                     defaultHierarchy[name] = { renders: [], renderedBy: [] };
//                 });
//                 fileGraph.componentHierarchy = defaultHierarchy;
//             }
//         }
//     }
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
//     buildParentMap(ast, null, parentMap);

//     // Track hooks directly
//     const hooksUsed = new Set<string>();

//     const visitors = {
//         CallExpression: (node: any) => {
//             // Check for React hooks (functions that start with 'use')
//             if (node.callee?.type === 'Identifier' &&
//                 node.callee.name.startsWith('use')) {
//                 hooksUsed.add(node.callee.name);

//                 // For useState, attempt to find the array pattern it's assigned to
//                 if (node.callee.name === 'useState') {
//                     let parentNode = parentMap.get(node);
//                     while (parentNode && parentNode.type !== 'VariableDeclarator') {
//                         parentNode = parentMap.get(parentNode);
//                     }

//                     // If we found the variable declarator, extract state variables
//                     if (parentNode?.id?.type === 'ArrayPattern' &&
//                         parentNode.id.elements?.length >= 2) {
//                         const stateVar = parentNode.id.elements[0];
//                         const setterVar = parentNode.id.elements[1];

//                         if (stateVar?.type === 'Identifier' && setterVar?.type === 'Identifier') {
//                             const varName = stateVar.name;
//                             const setterName = setterVar.name;

//                             // Create and add state variable
//                             const stateVarGraph: VariableGraph = {
//                                 name: `${varName} (State)`,
//                                 type: 'State',
//                                 dependencies: [{ 'useState': 'react' }]
//                             };

//                             // Create and add setter variable
//                             const setterVarGraph: VariableGraph = {
//                                 name: `${setterName} (State Setter)`,
//                                 type: 'StateSetter',
//                                 dependencies: [{ [varName]: 'state-var' }]
//                             };

//                             // Ensure these are always added to the file graph
//                             if (!fileGraph.variables.some(v => v.name === stateVarGraph.name)) {
//                                 fileGraph.variables.push(stateVarGraph);
//                             }

//                             if (!fileGraph.variables.some(v => v.name === setterVarGraph.name)) {
//                                 fileGraph.variables.push(setterVarGraph);
//                             }
//                         }
//                     }
//                 }
//             }
//         },

//         VariableDeclaration: (node: any) => {
//             node.declarations.forEach((decl: any) => {
//                 if (decl.id?.type === 'ArrayPattern' &&
//                     decl.init?.type === 'CallExpression' &&
//                     decl.init.callee?.type === 'Identifier' &&
//                     decl.init.callee.name.startsWith('use')) {

//                     const hookName = decl.init.callee.name;
//                     hooksUsed.add(hookName);

//                     if (hookName === 'useState' && decl.id.elements?.length >= 2) {
//                         const stateVar = decl.id.elements[0];
//                         const setterVar = decl.id.elements[1];

//                         if (stateVar?.type === 'Identifier') {
//                             const varName = stateVar.name;

//                             const stateVarGraph: VariableGraph = {
//                                 name: `${varName} (State)`,
//                                 type: 'State',
//                                 dependencies: [{ 'useState': 'react' }]
//                             };

//                             // Force add even if it already exists
//                             const existingIndex = fileGraph.variables.findIndex(v => v.name === stateVarGraph.name);
//                             if (existingIndex >= 0) {
//                                 fileGraph.variables[existingIndex] = stateVarGraph;
//                             } else {
//                                 fileGraph.variables.push(stateVarGraph);
//                             }

//                             if (setterVar?.type === 'Identifier') {
//                                 const setterName = setterVar.name;
//                                 hookVariables[varName] = [setterName];

//                                 const setterVarGraph: VariableGraph = {
//                                     name: `${setterName} (State Setter)`,
//                                     type: 'StateSetter',
//                                     dependencies: [{ [varName]: 'state-var' }]
//                                 };

//                                 // Force add even if it already exists
//                                 const existingSetterIndex = fileGraph.variables.findIndex(v => v.name === setterVarGraph.name);
//                                 if (existingSetterIndex >= 0) {
//                                     fileGraph.variables[existingSetterIndex] = setterVarGraph;
//                                 } else {
//                                     fileGraph.variables.push(setterVarGraph);
//                                 }
//                             }
//                         }
//                     }
//                 }
//             });
//         }
//     };

//     // Use our custom traversal to ensure we find all hooks
//     lightTraverseWithParents(ast, visitors);

//     // Add the hooks used as variables
//     hooksUsed.forEach(hookName => {
//         const hookVar: VariableGraph = {
//             name: hookName,
//             type: 'React Hook',
//             dependencies: [{ 'react': 'module' }]
//         };

//         // Avoid duplication
//         if (!fileGraph.variables.some(v => v.name === hookVar.name)) {
//             fileGraph.variables.push(hookVar);
//         }
//     });
// }

// // Helper to build parent map for hook detection
// function buildParentMap(node: any, parent: any, map: Map<any, any> = new Map()): Map<any, any> {
//     if (!node || typeof node !== 'object') return map;

//     map.set(node, parent);

//     for (const key in node) {
//         if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
//             const child = node[key];
//             if (child && typeof child === 'object') {
//                 if (Array.isArray(child)) {
//                     child.forEach(item => buildParentMap(item, node, map));
//                 } else {
//                     buildParentMap(child, node, map);
//                 }
//             }
//         }
//     }

//     return map;
// }

// // New helper function to check if a node is inside a React component
// function isInComponent(node: any, parentMap: Map<any, any>): boolean {
//     let current = node;

//     while (current && parentMap.has(current)) {
//         const parent = parentMap.get(current);

//         // Check if this is a component function
//         if ((parent.type === 'FunctionDeclaration' ||
//             parent.type === 'ArrowFunctionExpression' ||
//             parent.type === 'FunctionExpression')) {

//             // Component names usually start with capital letter
//             if (parent.type === 'FunctionDeclaration' && parent.id?.name) {
//                 if (/^[A-Z]/.test(parent.id.name)) {
//                     return true;
//                 }
//             }

//             // Check variable name for function expressions and arrow functions
//             let current = parent;
//             while (current && parentMap.has(current)) {
//                 const p = parentMap.get(current);
//                 if (p.type === 'VariableDeclarator' && p.id?.type === 'Identifier') {
//                     if (/^[A-Z]/.test(p.id.name)) {
//                         return true;
//                     }
//                     break;
//                 }
//                 current = p;
//             }

//             // Check if the function returns JSX
//             if (parent.body && parent.body.type === 'BlockStatement') {
//                 let hasJsx = false;
//                 const visitor = {
//                     ReturnStatement: (returnNode: any) => {
//                         if (returnNode.argument &&
//                             (returnNode.argument.type === 'JSXElement' ||
//                                 returnNode.argument.type === 'JSXFragment')) {
//                             hasJsx = true;
//                         }
//                     }
//                 };

//                 lightTraverse(parent.body, visitor);
//                 if (hasJsx) {
//                     return true;
//                 }
//             }
//         }

//         current = parent;
//     }

//     return false;
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

// // Define the lightTraverseWithParents function
// function lightTraverseWithParents(ast: any, visitors: Record<string, Function>, visited: Set<any> = new Set()): void {
//     function visit(node: any, parent: any = null, grandparent: any = null) {
//         if (!node || typeof node !== 'object' || visited.has(node)) return;

//         visited.add(node);

//         if (node.type && visitors[node.type]) {
//             visitors[node.type](node, parent, grandparent);
//         }

//         for (const key of Object.keys(node)) {
//             if (key === 'loc' || key === 'range' || key === 'parent') continue;

//             const child = node[key];
//             if (!child || typeof child !== 'object') continue;

//             if (Array.isArray(child)) {
//                 for (const item of child) {
//                     visit(item, node, parent);
//                 }
//             } else {
//                 visit(child, node, parent);
//             }
//         }
//     }

//     visit(ast);
// }

// // Improved component hierarchy builder
// function buildComponentHierarchy(
//     ast: any,
//     fileGraph: FileGraph,
//     componentNames: Set<string>,
//     parentMap: Map<any, any>
// ): Record<string, { renders: string[], renderedBy: string[] }> {
//     const componentHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};

//     // Initialize hierarchy for all components
//     componentNames.forEach(name => {
//         componentHierarchy[name] = {
//             renders: [],
//             renderedBy: []
//         };
//     });

//     // Function to find containing component function for a JSX element
//     const findContainingComponent = (node: any): string | null => {
//         let current = node;

//         while (current && parentMap.has(current)) {
//             const parent = parentMap.get(current);

//             // Check if it's a function or arrow function
//             if ((parent.type === 'FunctionDeclaration' ||
//                 parent.type === 'ArrowFunctionExpression' ||
//                 parent.type === 'FunctionExpression')) {

//                 // Get function name
//                 let name = null;

//                 if (parent.type === 'FunctionDeclaration' && parent.id) {
//                     name = parent.id.name;
//                 } else {
//                     // For arrow functions and function expressions, find variable declaration
//                     let current = parent;
//                     while (current && parentMap.has(current)) {
//                         const p = parentMap.get(current);
//                         if (p.type === 'VariableDeclarator' && p.id && p.id.type === 'Identifier') {
//                             name = p.id.name;
//                             break;
//                         }
//                         current = p;
//                     }
//                 }

//                 if (name && componentNames.has(name)) {
//                     return name;
//                 }
//             }

//             current = parent;
//         }

//         return null;
//     };

//     // Find JSX elements and track relationships
//     const visitors = {
//         JSXElement: (node: any) => {
//             if (node.openingElement && node.openingElement.name) {
//                 const elementName =
//                     node.openingElement.name.type === 'JSXIdentifier'
//                         ? node.openingElement.name.name
//                         : null;

//                 // Only process component references (capitalized names)
//                 if (elementName && elementName[0] === elementName[0].toUpperCase()) {
//                     // Find which component contains this JSX
//                     const parentComponent = findContainingComponent(node);

//                     if (parentComponent && componentHierarchy[parentComponent]) {
//                         // Add element as rendered by this component
//                         if (!componentHierarchy[parentComponent].renders.includes(elementName)) {
//                             componentHierarchy[parentComponent].renders.push(elementName);
//                         }

//                         // Update rendered-by relationship if element is a tracked component
//                         if (componentHierarchy[elementName]) {
//                             if (!componentHierarchy[elementName].renderedBy.includes(parentComponent)) {
//                                 componentHierarchy[elementName].renderedBy.push(parentComponent);
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     };

//     // Traverse the AST to find all JSX elements
//     lightTraverse(ast, visitors);

//     return componentHierarchy;
// }

// // Helper functions
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

// function findFunctionCalls(node: any, content: string, ast: any): string[] {
//     const calls: string[] = [];
//     const importReferences = new Map();

//     // First find all variable declarations that reference imports
//     const scopeVisitor = {
//         VariableDeclaration: (node: any) => {
//             node.declarations.forEach((decl: any) => {
//                 if (decl.id?.type === 'Identifier' &&
//                     decl.init?.type === 'Identifier') {
//                     // Track variables that reference other identifiers
//                     importReferences.set(decl.id.name, decl.init.name);
//                 }
//             });
//         }
//     };

//     // Then find all function calls
//     const callVisitor = {
//         CallExpression: (node: any) => {
//             if (node.callee?.type === 'Identifier') {
//                 const calleeName = node.callee.name;
//                 // Check if this is a direct call or via a reference
//                 const actualName = importReferences.get(calleeName) || calleeName;
//                 calls.push(actualName);
//             }
//             else if (node.callee?.type === 'MemberExpression' &&
//                 node.callee.property?.type === 'Identifier') {
//                 // For object method calls like obj.method()
//                 if (node.callee.object?.type === 'Identifier') {
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
//     if (node.body) {
//         lightTraverse(node.body, scopeVisitor);
//         lightTraverse(node.body, callVisitor);
//     }

//     return calls;
// }
// src/parser/react-parser.js
import { parse } from '@babel/parser';
import path from 'path';
import { FileGraph, FileParser, FunctionGraph, VariableGraph } from '../types/interfaces';
import { getStartLine, countLines, lightTraverse, normalizePath } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';
import { createJsParser } from './js-parser';

export function createReactParser(): FileParser {
    const jsParser = createJsParser();
    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`React Parser: parsing ${filePath}`);
            // Preserve original case in file path
            const normalizedPath = normalizePath(filePath);
            const fileGraph = await jsParser.parse(normalizedPath, content);

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

                // Use the same parent map for all traversals for consistency
                const parentMap = buildParentMap(ast, null);

                extractReactImports(ast, fileGraph);
                extractReactComponents(ast, fileGraph, normalizedPath, content, parentMap);
                extractReactHooks(ast, fileGraph, normalizedPath, parentMap);

                return fileGraph;
            } catch (error) {
                logger.warn(`React-specific parsing failed for ${normalizedPath}, using JS parser result:`, error);
                return fileGraph;
            }
        }
    };
}

function extractReactImports(ast: any, fileGraph: FileGraph): void {
    const visitors = {
        ImportDeclaration: (node: any) => {
            const source = node.source.value;

            // Process all imports, not just react ones
            const importNames: string[] = [];
            node.specifiers.forEach((specifier: any) => {
                if (specifier.type === 'ImportDefaultSpecifier') {
                    importNames.push('default');

                    // Also add the local name of default imports
                    if (specifier.local?.name) {
                        importNames.push(specifier.local.name);
                    }
                }
                else if (specifier.type === 'ImportSpecifier') {
                    if (specifier.imported && specifier.imported.name) {
                        importNames.push(specifier.imported.name);
                    }

                    if (specifier.local && specifier.local.name) {
                        // Handle the case where imported name might not be available
                        importNames.push(specifier.local.name);
                    }
                }
            });

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
    };

    lightTraverse(ast, visitors);
}

function extractReactComponents(ast: any, fileGraph: FileGraph, filePath: string, content: string, parentMap: Map<any, any>): void {
    // Check if a node is a React component
    const isReactComponent = (node: any): boolean => {
        if (node.body && node.body.type === 'BlockStatement') {
            let hasJsx = false;
            let usesHooks = false;
            const visitor = {
                ReturnStatement: (returnNode: any) => {
                    if (returnNode.argument &&
                        (returnNode.argument.type === 'JSXElement' ||
                            returnNode.argument.type === 'JSXFragment')) {
                        hasJsx = true;
                    }
                },
                CallExpression: (callNode: any) => {
                    if (callNode.callee &&
                        callNode.callee.type === 'Identifier' &&
                        callNode.callee.name.startsWith('use')) {
                        usesHooks = true;
                    }
                }
            };
            lightTraverse(node.body, visitor);
            return hasJsx || usesHooks;
        }
        if (node.body &&
            (node.body.type === 'JSXElement' ||
                node.body.type === 'JSXFragment')) {
            return true;
        }
        return false;
    };

    // Get the variable declaration for a node
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

    // Track component names for hierarchy building
    const componentNames = new Set<string>();

    // Visitors for traversing the AST
    const visitors = {
        ArrowFunctionExpression: (node: any) => {
            if (isReactComponent(node)) {
                const parentDecl = getVariableDeclaration(node);
                if (parentDecl && parentDecl.id && parentDecl.id.type === 'Identifier') {
                    if (isTopLevel(parentDecl, parentMap)) {
                        const name = parentDecl.id.name;
                        const startLine = getStartLine(node);

                        // Create regular function entry
                        if (!fileGraph.functions.some(fn => fn.name === name)) {
                            const regularFunction: FunctionGraph = {
                                fileName: path.basename(filePath),
                                name: name,
                                referencedIn: [filePath],
                                startLine,
                                length: node.body ? countLines(content.substring(
                                    node.body.start || 0,
                                    node.body.end || content.length
                                )) : 0,
                                dependencies: [],
                                types: [],
                                callsTo: findFunctionCalls(node, content, ast, parentMap),
                            };
                            fileGraph.functions.push(regularFunction);
                        }

                        // Create React component entry
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
                            callsTo: findFunctionCalls(node, content, ast, parentMap),
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
            if (node.id) {
                const name = node.id.name;
                const startLine = getStartLine(node);

                // For component functions (top-level or nested)
                if (isReactComponent(node)) {
                    // Top-level components get both regular and component versions
                    if (isTopLevel(node, parentMap)) {
                        // Add regular function version
                        if (!fileGraph.functions.some(fn => fn.name === name)) {
                            const regularFunction: FunctionGraph = {
                                fileName: path.basename(filePath),
                                name: name,
                                referencedIn: [filePath],
                                startLine,
                                length: node.body ? countLines(content.substring(
                                    node.body.start || 0,
                                    node.body.end || content.length
                                )) : 0,
                                dependencies: [],
                                types: [],
                                callsTo: findFunctionCalls(node, content, ast, parentMap),
                            };
                            fileGraph.functions.push(regularFunction);
                        }

                        // Add React component version
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
                            callsTo: findFunctionCalls(node, content, ast, parentMap),
                        };
                        extractComponentProps(node, componentGraph);
                        if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
                            fileGraph.functions.push(componentGraph);
                            componentNames.add(name); // Track component name for hierarchy
                        }
                    }
                }
                // For nested functions like handleClick
                else if (!isTopLevel(node, parentMap) && isInComponent(node, parentMap)) {
                    const functionGraph: FunctionGraph = {
                        fileName: path.basename(filePath),
                        name,
                        referencedIn: [filePath],
                        startLine,
                        length: node.body ? countLines(content.substring(
                            node.body.start || 0,
                            node.body.end || content.length
                        )) : 0,
                        dependencies: [],
                        types: inferFunctionReturnType(node),
                        callsTo: findFunctionCalls(node, content, ast, parentMap),
                    };

                    if (!fileGraph.functions.some(fn => fn.name === name)) {
                        fileGraph.functions.push(functionGraph);
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

                        // Add regular function first
                        if (!fileGraph.functions.some(fn => fn.name === name)) {
                            const regularFunction: FunctionGraph = {
                                fileName: path.basename(filePath),
                                name: name,
                                referencedIn: [filePath],
                                startLine,
                                length: decl.init.body ? countLines(content.substring(
                                    decl.init.body.start || 0,
                                    decl.init.body.end || content.length
                                )) : 0,
                                dependencies: [],
                                types: [],
                                callsTo: findFunctionCalls(decl.init, content, ast, parentMap),
                            };
                            fileGraph.functions.push(regularFunction);
                        }

                        // Add React component version
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
                            callsTo: findFunctionCalls(decl.init, content, ast, parentMap),
                        };
                        extractComponentProps(decl.init, componentGraph);
                        if (!fileGraph.functions.some(fn => fn.name === componentGraph.name)) {
                            fileGraph.functions.push(componentGraph);
                            componentNames.add(name); // Track component name for hierarchy
                        }
                    }
                });
            }
            // Also check for arrow functions inside components (like handleClick)
            else if (isInComponent(node, parentMap)) {
                node.declarations.forEach((decl: any) => {
                    if (decl.id?.type === 'Identifier' &&
                        decl.init?.type === 'ArrowFunctionExpression') {
                        const name = decl.id.name;
                        const startLine = getStartLine(decl.init);

                        // Search for called imports from parent component
                        const dependencies: any = [];
                        const importedFunctions = getImportedFunctions(fileGraph);
                        const callsTo = findFunctionCalls(decl.init, content, ast, parentMap);

                        // Add any called imported functions as dependencies
                        callsTo.forEach(calledName => {
                            if (importedFunctions[calledName]) {
                                const importSource = importedFunctions[calledName];
                                dependencies.push({ [calledName]: importSource });
                            }
                        });

                        const functionGraph: FunctionGraph = {
                            fileName: path.basename(filePath),
                            name,
                            referencedIn: [filePath],
                            startLine,
                            length: decl.init.body ? countLines(content.substring(
                                decl.init.body.start || 0,
                                decl.init.body.end || content.length
                            )) : 0,
                            dependencies,
                            types: inferFunctionReturnType(decl.init),
                            callsTo,
                        };

                        if (!fileGraph.functions.some(fn => fn.name === name)) {
                            fileGraph.functions.push(functionGraph);
                        }
                    }
                });
            }
        }
    };

    // Traverse AST to find components and functions
    lightTraverse(ast, visitors);

    // Build component hierarchy with the tracked component names
    if (componentNames.size > 0) {
        const componentHierarchy = buildComponentHierarchy(ast, fileGraph, componentNames, parentMap);
        fileGraph.componentHierarchy = componentHierarchy;
    } else {
        // If no components were found but file has JSX extension, check for unnamed/inline components
        if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
            const functionNames = fileGraph.functions
                .filter(fn => fn.name !== 'root')
                .map(fn => fn.name.replace(' (React Component)', ''));

            // Create a default hierarchy for any named functions that might be components
            if (functionNames.length > 0) {
                const defaultHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};
                functionNames.forEach(name => {
                    defaultHierarchy[name] = { renders: [], renderedBy: [] };
                });
                fileGraph.componentHierarchy = defaultHierarchy;
            }
        }
    }
}

// Helper to get imported functions from file graph
function getImportedFunctions(fileGraph: FileGraph): Record<string, string> {
    const importedFunctions: Record<string, string> = {};

    // Check root dependencies
    const rootFn = fileGraph.functions.find(fn => fn.name === 'root');
    if (rootFn && rootFn.dependencies) {
        rootFn.dependencies.forEach(dep => {
            const name = Object.keys(dep)[0];
            const source = dep[name];
            importedFunctions[name] = source;
        });
    }

    // Check detailed dependencies
    if (fileGraph.detailedDependencies) {
        fileGraph.detailedDependencies.forEach(dep => {
            dep.imports.forEach(importName => {
                importedFunctions[importName] = dep.module;
            });
        });
    }

    return importedFunctions;
}

// Extract props from component parameters
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

// Extract React hooks from the AST
function extractReactHooks(ast: any, fileGraph: FileGraph, filePath: string, parentMap: Map<any, any>): void {
    // Initialize variables array if it doesn't exist
    if (!fileGraph.variables) {
        fileGraph.variables = [];
    }

    const hookVariables: Record<string, string[]> = {};

    // Track hooks used
    const hooksUsed = new Set<string>();
    const stateVars = new Set<string>();
    const stateSetters = new Set<string>();

    // Visit all useState calls to find state variables
    const visitors = {
        CallExpression: (node: any) => {
            // Check for React hooks (functions that start with 'use')
            if (node.callee?.type === 'Identifier' &&
                node.callee.name.startsWith('use')) {
                hooksUsed.add(node.callee.name);

                // For useState, attempt to find the array pattern it's assigned to
                if (node.callee.name === 'useState') {
                    // Start from the node and move up to find the variable declarator
                    let parentNode = parentMap.get(node);
                    while (parentNode && parentNode.type !== 'VariableDeclarator') {
                        parentNode = parentMap.get(parentNode);
                    }

                    // If we found a variable declarator with an array pattern, this is a useState call
                    if (parentNode?.id?.type === 'ArrayPattern' &&
                        parentNode.id.elements?.length >= 2) {
                        const stateVar = parentNode.id.elements[0];
                        const setterVar = parentNode.id.elements[1];

                        if (stateVar?.type === 'Identifier' && setterVar?.type === 'Identifier') {
                            const varName = stateVar.name;
                            const setterName = setterVar.name;

                            // Track these variable names to make sure we add them
                            stateVars.add(varName);
                            stateSetters.add(setterName);

                            // Create state variable
                            const stateVarGraph: VariableGraph = {
                                name: `${varName} (State)`,
                                type: 'State',
                                dependencies: [{ 'useState': 'react' }]
                            };

                            // Create setter variable
                            const setterVarGraph: VariableGraph = {
                                name: `${setterName} (State Setter)`,
                                type: 'StateSetter',
                                dependencies: [{ [varName]: 'state-var' }]
                            };

                            // Add variables to the graph after checking for duplicates
                            if (!fileGraph.variables.some(v => v.name === stateVarGraph.name)) {
                                fileGraph.variables.push(stateVarGraph);
                            }

                            if (!fileGraph.variables.some(v => v.name === setterVarGraph.name)) {
                                fileGraph.variables.push(setterVarGraph);
                            }
                        }
                    }
                }
            }
        },

        VariableDeclaration: (node: any) => {
            node.declarations.forEach((decl: any) => {
                if (decl.id?.type === 'ArrayPattern' &&
                    decl.init?.type === 'CallExpression' &&
                    decl.init.callee?.type === 'Identifier' &&
                    decl.init.callee.name.startsWith('use')) {

                    const hookName = decl.init.callee.name;
                    hooksUsed.add(hookName);

                    if (hookName === 'useState' && decl.id.elements?.length >= 2) {
                        const stateVar = decl.id.elements[0];
                        const setterVar = decl.id.elements[1];

                        if (stateVar?.type === 'Identifier') {
                            const varName = stateVar.name;
                            stateVars.add(varName);

                            const stateVarGraph: VariableGraph = {
                                name: `${varName} (State)`,
                                type: 'State',
                                dependencies: [{ 'useState': 'react' }]
                            };

                            // Replace if exists or add new
                            const existingIndex = fileGraph.variables.findIndex(v => v.name === stateVarGraph.name);
                            if (existingIndex >= 0) {
                                fileGraph.variables[existingIndex] = stateVarGraph;
                            } else {
                                fileGraph.variables.push(stateVarGraph);
                            }

                            if (setterVar?.type === 'Identifier') {
                                const setterName = setterVar.name;
                                stateSetters.add(setterName);
                                hookVariables[varName] = [setterName];

                                const setterVarGraph: VariableGraph = {
                                    name: `${setterName} (State Setter)`,
                                    type: 'StateSetter',
                                    dependencies: [{ [varName]: 'state-var' }]
                                };

                                // Replace if exists or add new
                                const existingSetterIndex = fileGraph.variables.findIndex(v => v.name === setterVarGraph.name);
                                if (existingSetterIndex >= 0) {
                                    fileGraph.variables[existingSetterIndex] = setterVarGraph;
                                } else {
                                    fileGraph.variables.push(setterVarGraph);
                                }
                            }
                        }
                    }
                }
            });
        }
    };

    // Use thorough traversal for hook detection
    lightTraverse(ast, visitors);

    // Double check - make sure we've added all state variables
    // This is a safeguard to ensure state variables are added
    if (stateVars.size > 0 && fileGraph.variables.length === 0) {
        stateVars.forEach(varName => {
            const stateVarGraph: VariableGraph = {
                name: `${varName} (State)`,
                type: 'State',
                dependencies: [{ 'useState': 'react' }]
            };
            fileGraph.variables.push(stateVarGraph);
        });

        stateSetters.forEach(setterName => {
            // Find corresponding state var
            for (const [stateVar, setters] of Object.entries(hookVariables)) {
                if (setters.includes(setterName)) {
                    const setterVarGraph: VariableGraph = {
                        name: `${setterName} (State Setter)`,
                        type: 'StateSetter',
                        dependencies: [{ [stateVar]: 'state-var' }]
                    };
                    fileGraph.variables.push(setterVarGraph);
                    break;
                }
            }
        });
    }

    // Add all detected hooks as variables
    hooksUsed.forEach(hookName => {
        const hookVar: VariableGraph = {
            name: hookName,
            type: 'React Hook',
            dependencies: [{ 'react': 'module' }]
        };

        if (!fileGraph.variables.some(v => v.name === hookVar.name)) {
            fileGraph.variables.push(hookVar);
        }
    });
}

// Build parent map for AST traversal
function buildParentMap(node: any, parent: any, map: Map<any, any> = new Map()): Map<any, any> {
    if (!node || typeof node !== 'object') return map;

    map.set(node, parent);

    for (const key in node) {
        if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
            const child = node[key];
            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    child.forEach(item => buildParentMap(item, node, map));
                } else {
                    buildParentMap(child, node, map);
                }
            }
        }
    }

    return map;
}

// Check if a node is inside a React component
function isInComponent(node: any, parentMap: Map<any, any>): boolean {
    let current = node;

    while (current && parentMap.has(current)) {
        const parent = parentMap.get(current);

        // Check if this is a component function
        if ((parent.type === 'FunctionDeclaration' ||
            parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression')) {

            // Component names usually start with capital letter
            if (parent.type === 'FunctionDeclaration' && parent.id?.name) {
                if (/^[A-Z]/.test(parent.id.name)) {
                    return true;
                }
            }

            // Check variable name for function expressions and arrow functions
            let current = parent;
            while (current && parentMap.has(current)) {
                const p = parentMap.get(current);
                if (p.type === 'VariableDeclarator' && p.id?.type === 'Identifier') {
                    if (/^[A-Z]/.test(p.id.name)) {
                        return true;
                    }
                    break;
                }
                current = p;
            }

            // Check if the function returns JSX
            if (parent.body && parent.body.type === 'BlockStatement') {
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
                if (hasJsx) {
                    return true;
                }
            }
        }

        current = parent;
    }

    return false;
}

// Check if a node is at the top level
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

// Traverse AST with parent context
function lightTraverseWithParents(ast: any, visitors: Record<string, Function>, visited: Set<any> = new Set()): void {
    function visit(node: any, parent: any = null, grandparent: any = null) {
        if (!node || typeof node !== 'object' || visited.has(node)) return;

        visited.add(node);

        if (node.type && visitors[node.type]) {
            visitors[node.type](node, parent, grandparent);
        }

        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'range' || key === 'parent') continue;

            const child = node[key];
            if (!child || typeof child !== 'object') continue;

            if (Array.isArray(child)) {
                for (const item of child) {
                    visit(item, node, parent);
                }
            } else {
                visit(child, node, parent);
            }
        }
    }

    visit(ast);
}

// Build component hierarchy
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

    // Find containing component function for a JSX element
    const findContainingComponent = (node: any): string | null => {
        let current = node;

        while (current && parentMap.has(current)) {
            const parent = parentMap.get(current);

            // Check if it's a function or arrow function
            if ((parent.type === 'FunctionDeclaration' ||
                parent.type === 'ArrowFunctionExpression' ||
                parent.type === 'FunctionExpression')) {

                // Get function name
                let name = null;

                if (parent.type === 'FunctionDeclaration' && parent.id) {
                    name = parent.id.name;
                } else {
                    // For arrow functions and function expressions, find variable declaration
                    let current = parent;
                    while (current && parentMap.has(current)) {
                        const p = parentMap.get(current);
                        if (p.type === 'VariableDeclarator' && p.id && p.id.type === 'Identifier') {
                            name = p.id.name;
                            break;
                        }
                        current = p;
                    }
                }

                if (name && componentNames.has(name)) {
                    return name;
                }
            }

            current = parent;
        }

        return null;
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

// Get function return type from TypeScript annotations
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

// Find function calls in a node
function findFunctionCalls(node: any, content: string, ast: any, parentMap: Map<any, any>): string[] {
    const calls: string[] = [];
    const importReferences = new Map();

    // First find variable declarations that reference imports
    const scopeVisitor = {
        ImportDeclaration: (node: any) => {
            node.source.value; // Module name
            node.specifiers.forEach((spec: any) => {
                if (spec.local?.name && spec.imported?.name) {
                    importReferences.set(spec.local.name, spec.imported.name);
                }
            });
        },
        VariableDeclaration: (node: any) => {
            node.declarations.forEach((decl: any) => {
                if (decl.id?.type === 'Identifier' &&
                    decl.init?.type === 'Identifier') {
                    // Track variables that reference other identifiers
                    importReferences.set(decl.id.name, decl.init.name);
                }
            });
        }
    };

    // Then find all function calls
    const callVisitor = {
        CallExpression: (node: any) => {
            if (node.callee?.type === 'Identifier') {
                const calleeName = node.callee.name;
                // Check if this is a direct call or via a reference
                const actualName = importReferences.get(calleeName) || calleeName;
                calls.push(actualName);
            }
            else if (node.callee?.type === 'MemberExpression' &&
                node.callee.property?.type === 'Identifier') {
                // For object method calls like obj.method()
                if (node.callee.object?.type === 'Identifier') {
                    // Special case for ReactDOM.render
                    if (node.callee.object.name === 'ReactDOM' && node.callee.property.name === 'render') {
                        calls.push('ReactDOM.render');
                    } else {
                        // If we can identify the object, use "object.method" format
                        calls.push(`${node.callee.object.name}.${node.callee.property.name}`);
                    }
                } else {
                    // Otherwise just use the method name
                    calls.push(node.callee.property.name);
                }
            }
        }
    };

    // First analyze imports and variables, then find calls
    if (node.body) {
        lightTraverse(ast, scopeVisitor); // Check whole AST for imports
        lightTraverse(node.body, callVisitor); // Check function body for calls
    } else {
        lightTraverse(node, callVisitor);
    }

    return calls;
}
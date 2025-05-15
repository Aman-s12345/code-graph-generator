
// // src/analyzer/relationship-analyzer.ts
// import { CodeGraph, FileGraph, FunctionGraph, TypeGraph } from '../types/interfaces';
// import path from 'path';

// export function analyzeRelationships(codeGraph: CodeGraph): CodeGraph {
//   const functionMap = buildFunctionMap(codeGraph);
//   const typeMap = buildTypeMap(codeGraph);
//   const enhancedGraph = {
//     ...codeGraph,
//     packages: codeGraph.packages.map(pkg => ({
//       ...pkg,
//       files: pkg.files.map(file => enhanceFileRelationships(file, codeGraph, functionMap, typeMap))
//     }))
//   };
//   return enhancedGraph;
// }

// function enhanceFileRelationships(
//   file: FileGraph,
//   codeGraph: CodeGraph,
//   functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>,
//   typeMap: Map<string, { type: TypeGraph, file: FileGraph }>
// ): FileGraph {
//   return {
//     ...file,
//     functions: file.functions.map(fn => ({
//       ...fn,
//       callsTo: fn.callsTo || findFunctionCalls(fn, file, codeGraph, functionMap),
//       calledBy: findFunctionCallers(fn, codeGraph, functionMap)
//     })),
//     componentHierarchy: file.componentHierarchy
//       ? enhanceComponentHierarchy(file.componentHierarchy, file, codeGraph)
//       : (file.path.endsWith('.jsx') || file.path.endsWith('.tsx') || file.path.endsWith('.js')
//         ? buildComponentHierarchy(file, codeGraph, functionMap)
//         : undefined),
//     detailedDependencies: analyzeModuleDependencies(file, codeGraph)
//   };
// }

// function enhanceComponentHierarchy(
//   hierarchy: Record<string, { renders: string[], renderedBy: string[] }>,
//   file: FileGraph,
//   codeGraph: CodeGraph
// ): Record<string, { renders: string[], renderedBy: string[] }> {
//   // Check if the hierarchy has the renderedBy property already
//   const hasRenderedBy = Object.values(hierarchy).some(h => 'renderedBy' in h);

//   // If it already has the full structure, return it
//   if (hasRenderedBy) return hierarchy;

//   // Otherwise, enhance it with renderedBy relationships
//   const enhanced: Record<string, { renders: string[], renderedBy: string[] }> = {};

//   // Initialize with existing renders
//   Object.keys(hierarchy).forEach(component => {
//     enhanced[component] = {
//       renders: hierarchy[component].renders || [],
//       renderedBy: []
//     };
//   });

//   // Add renderedBy relationships
//   Object.keys(enhanced).forEach(component => {
//     const renders = enhanced[component].renders;
//     renders.forEach(rendered => {
//       if (enhanced[rendered]) {
//         enhanced[rendered].renderedBy.push(component);
//       } else {
//         enhanced[rendered] = {
//           renders: [],
//           renderedBy: [component]
//         };
//       }
//     });
//   });

//   return enhanced;
// }

// function buildFunctionMap(codeGraph: CodeGraph): Map<string, { function: FunctionGraph, file: FileGraph }> {
//   const functionMap = new Map();

//   codeGraph.packages.forEach(pkg => {
//     pkg.files.forEach(file => {
//       file.functions.forEach(fn => {
//         if (fn.name !== 'root') {
//           // Store with qualified name (file:function)
//           const qualifiedName = `${file.path}:${fn.name}`;
//           functionMap.set(qualifiedName, { function: fn, file });

//           // Also store by function name for simpler lookups
//           // But only if there's no collision
//           if (!functionMap.has(fn.name)) {
//             functionMap.set(fn.name, { function: fn, file });
//           }
//         }
//       });
//     });
//   });

//   return functionMap;
// }

// function buildTypeMap(codeGraph: CodeGraph): Map<string, { type: TypeGraph, file: FileGraph }> {
//   const typeMap = new Map();

//   codeGraph.packages.forEach(pkg => {
//     pkg.files.forEach(file => {
//       file.types.forEach(type => {
//         // Store with qualified name (file:type)
//         const qualifiedName = `${file.path}:${type.name}`;
//         typeMap.set(qualifiedName, { type, file });

//         // Also store by type name for simpler lookups
//         // But only if there's no collision
//         if (!typeMap.has(type.name)) {
//           typeMap.set(type.name, { type, file });
//         }
//       });
//     });
//   });

//   return typeMap;
// }

// function findFunctionCalls(
//   fn: FunctionGraph,
//   file: FileGraph,
//   codeGraph: CodeGraph,
//   functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
// ): string[] {
//   // If the function already has callsTo from the parser, use it
//   if (fn.callsTo && fn.callsTo.length > 0) {
//     return fn.callsTo;
//   }

//   const calls: string[] = [];

//   // For root function, extract from dependencies
//   if (fn.name === 'root') {
//     fn.dependencies.forEach(dep => {
//       const importedName = Object.keys(dep)[0];
//       if (functionMap.has(importedName)) {
//         calls.push(importedName);
//       }
//     });
//     return calls;
//   }

//   // For regular functions, look at dependencies
//   if (fn.dependencies) {
//     fn.dependencies.forEach(dep => {
//       const importedName = Object.keys(dep)[0];
//       if (functionMap.has(importedName)) {
//         calls.push(importedName);
//       }
//     });
//   }

//   // Only add local functions that are likely to be called
//   const localFunctions = file.functions
//     .filter(otherFn => otherFn.name !== fn.name && otherFn.name !== 'root');

//   // For each local function, check if it's referenced in the function
//   localFunctions.forEach(localFn => {
//     // Here we could have more sophisticated detection
//     // But for now we'll trust the callsTo property from the parser
//     if (fn.callsTo && fn.callsTo.includes(localFn.name)) {
//       calls.push(localFn.name);
//     }
//   });

//   // Find calls to imported functions from other files
//   file.dependencies.forEach(dep => {
//     const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
//     if (depFile) {
//       depFile.exports.forEach(exportName => {
//         const exportedFn = depFile.functions.find(f => f.name === exportName);
//         if (exportedFn) {
//           // Check if this function calls the exported one
//           const depKey = `${exportName}`;
//           if (fn.dependencies && fn.dependencies.some(d => Object.keys(d)[0] === depKey)) {
//             calls.push(exportName);
//           }
//           // Also check callsTo property
//           if (fn.callsTo && fn.callsTo.includes(exportName)) {
//             calls.push(exportName);
//           }
//         }
//       });
//     }
//   });

//   // Deduplicate
//   return [...new Set(calls)];
// }

// function findFunctionCallers(
//   fn: FunctionGraph,
//   codeGraph: CodeGraph,
//   functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
// ): string[] {
//   const callers: string[] = [];

//   if (fn.name === 'root') {
//     return callers; // root is never called
//   }

//   codeGraph.packages.forEach(pkg => {
//     pkg.files.forEach(file => {
//       const isExported = file.exports.includes(fn.name);
//       const fileContainsFn = file.path === fn.fileName ||
//         file.functions.some(f => f.name === fn.name);

//       file.functions.forEach(potentialCaller => {
//         // Skip if it's the same function or root
//         if (potentialCaller.name === fn.name || potentialCaller.name === 'root') {
//           return;
//         }

//         // Check if there's a direct call reference
//         if (potentialCaller.callsTo && potentialCaller.callsTo.includes(fn.name)) {
//           callers.push(`${file.path}:${potentialCaller.name}`);
//           return;
//         }

//         // Check dependencies for imported function references
//         if (isExported || fileContainsFn) {
//           if (potentialCaller.dependencies && potentialCaller.dependencies.length > 0) {
//             const callsFunction = potentialCaller.dependencies.some(dep => {
//               const depName = Object.keys(dep)[0];
//               return depName === fn.name;
//             });

//             if (callsFunction) {
//               callers.push(`${file.path}:${potentialCaller.name}`);
//             }
//           }
//         }
//       });
//     });
//   });

//   return callers;
// }

// function buildComponentHierarchy(
//   file: FileGraph,
//   codeGraph: CodeGraph,
//   functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
// ): Record<string, { renders: string[], renderedBy: string[] }> {
//   const componentHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};

//   // Find components by looking for functions that start with capital letter
//   // and (ideally) have a React component indicator
//   const componentFunctions = file.functions.filter(fn => {
//     // Either it's marked as a component, or it has a capital first letter
//     const isComponent = fn.name.includes('(React Component)') ||
//       (fn.name !== 'root' && /^[A-Z]/.test(fn.name));
//     return isComponent;
//   });

//   // Initialize hierarchy
//   componentFunctions.forEach(component => {
//     // Clean up name (remove React Component suffix)
//     const cleanName = component.name.replace(' (React Component)', '');
//     componentHierarchy[cleanName] = {
//       renders: [],
//       renderedBy: []
//     };
//   });

//   // Find imported components
//   const importedComponents: Record<string, string> = {};
//   file.dependencies.forEach(dep => {
//     const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
//     if (!depFile) return;

//     depFile.exports.forEach(exportName => {
//       // Likely a component if capitalized
//       if (/^[A-Z]/.test(exportName)) {
//         importedComponents[exportName] = depFile.path;
//       }
//     });
//   });

//   // Now determine actual component relationships based on:
//   // 1. Function calls
//   // 2. JSX usage (if available)
//   componentFunctions.forEach(component => {
//     const cleanName = component.name.replace(' (React Component)', '');

//     // Use callsTo if available
//     if (component.callsTo && component.callsTo.length > 0) {
//       component.callsTo.forEach(calledName => {
//         // Filter to components (start with capital letter)
//         if (/^[A-Z]/.test(calledName)) {
//           componentHierarchy[cleanName].renders.push(calledName);
//         }
//       });
//     }

//     // Look for dependencies that match imports
//     if (component.dependencies) {
//       component.dependencies.forEach(dep => {
//         const depName = Object.keys(dep)[0];
//         if (importedComponents[depName]) {
//           componentHierarchy[cleanName].renders.push(depName);
//         }
//       });
//     }

//     // In the absence of clear JSX analysis, we can use component
//     // hierarchy data from React parser if available
//     if (file.componentHierarchy && file.componentHierarchy[cleanName]) {
//       const existingRenders = file.componentHierarchy[cleanName].renders || [];
//       componentHierarchy[cleanName].renders = [
//         ...new Set([...componentHierarchy[cleanName].renders, ...existingRenders])
//       ];
//     }
//   });

//   // Build the renderedBy inverse relationships
//   Object.keys(componentHierarchy).forEach(component => {
//     const renders = componentHierarchy[component].renders;
//     renders.forEach(rendered => {
//       if (componentHierarchy[rendered]) {
//         if (!componentHierarchy[rendered].renderedBy.includes(component)) {
//           componentHierarchy[rendered].renderedBy.push(component);
//         }
//       } else {
//         // Add entry for imported component that's rendered
//         componentHierarchy[rendered] = {
//           renders: [],
//           renderedBy: [component]
//         };
//       }
//     });
//   });

//   return componentHierarchy;
// }

// function analyzeModuleDependencies(
//   file: FileGraph,
//   codeGraph: CodeGraph
// ): Array<{ module: string, imports: string[] }> {
//   const detailedDependencies: Array<{ module: string, imports: string[] }> = [];

//   // If the file already has detailed dependencies, use them as a starting point
//   if (file.detailedDependencies && file.detailedDependencies.length > 0) {
//     return file.detailedDependencies;
//   }

//   file.dependencies.forEach(dep => {
//     const imports: string[] = [];

//     // Check all functions for dependencies on this module
//     file.functions.forEach(fn => {
//       if (fn.dependencies) {
//         fn.dependencies.forEach(fnDep => {
//           const importName = Object.keys(fnDep)[0];
//           const importSource = fnDep[importName];
//           if (importSource === dep) {
//             imports.push(importName);
//           }
//         });
//       }
//     });

//     // Create a record for this dependency
//     detailedDependencies.push({
//       module: dep,
//       imports: [...new Set(imports)]
//     });
//   });

//   return detailedDependencies;
// }

// function resolveImportPath(importerPath: string, importPath: string): string {
//   // Handle absolute imports
//   if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
//     return importPath;
//   }

//   // Resolve relative path
//   const importerDir = path.dirname(importerPath);
//   let resolvedPath = path.normalize(path.join(importerDir, importPath)).replace(/\\/g, '/');

//   // If the path doesn't have an extension, try common extensions
//   if (!path.extname(resolvedPath)) {
//     // Return the path without extension - the file finder will handle multiple extensions
//     return resolvedPath;
//   }

//   return resolvedPath;
// }

// function findFileByPath(codeGraph: CodeGraph, filePath: string): FileGraph | undefined {
//   // Try multiple extensions if the path doesn't have one
//   const extensions = path.extname(filePath) ? [''] : ['', '.js', '.jsx', '.ts', '.tsx'];

//   for (const ext of extensions) {
//     const pathToFind = filePath + ext;

//     for (const pkg of codeGraph.packages) {
//       for (const file of pkg.files) {
//         // Direct path match
//         if (file.path === pathToFind) {
//           return file;
//         }

//         // Compare without extensions
//         const filePathNoExt = file.path.replace(/\.[^/.]+$/, "");
//         const searchPathNoExt = pathToFind.replace(/\.[^/.]+$/, "");
//         if (filePathNoExt === searchPathNoExt) {
//           return file;
//         }

//         // Normalized path comparison (handle Windows/Unix path differences)
//         const normalizedFilePath = file.path.replace(/\\/g, '/');
//         const normalizedSearchPath = pathToFind.replace(/\\/g, '/');
//         if (normalizedFilePath === normalizedSearchPath) {
//           return file;
//         }
//       }
//     }
//   }

//   return undefined;
// }
// src/analyzer/relationship-analyzer.ts
import { CodeGraph, FileGraph, FunctionGraph, TypeGraph, PackageGraph } from '../types/interfaces';
import path from 'path';
import { normalizePath } from '../utils/ast-utils';

export function analyzeRelationships(codeGraph: CodeGraph): CodeGraph {
  const functionMap = buildFunctionMap(codeGraph);
  const typeMap = buildTypeMap(codeGraph);

  // Analyze package dependencies first
  analyzePackageDependencies(codeGraph);

  const enhancedGraph = {
    ...codeGraph,
    packages: codeGraph.packages.map(pkg => ({
      ...pkg,
      files: pkg.files.map(file => enhanceFileRelationships(file, codeGraph, functionMap, typeMap))
    }))
  };

  return enhancedGraph;
}

function analyzePackageDependencies(codeGraph: CodeGraph): void {
  const packageMap = new Map<string, PackageGraph>();

  // Build a map of packages by name
  codeGraph.packages.forEach(pkg => {
    packageMap.set(pkg.name, pkg);
  });

  // Find files that import from other packages
  codeGraph.packages.forEach(pkg => {
    const dependencies = new Set<string>();

    pkg.files.forEach(file => {
      file.dependencies.forEach(dep => {
        // Skip non-relative imports (node modules)
        if (!dep.startsWith('.')) return;

        // Resolve the import path
        const importPath = resolveImportPath(file.path, dep);
        const targetFile = findFileByPath(codeGraph, importPath);

        if (targetFile) {
          const targetPkg = codeGraph.packages.find(p =>
            p.files.some(f => f.path === targetFile.path)
          );

          if (targetPkg && targetPkg.name !== pkg.name) {
            dependencies.add(targetPkg.name);
          }
        }
      });
    });

    // Update package dependencies
    pkg.dependencies = Array.from(dependencies);
  });
}

function enhanceFileRelationships(
  file: FileGraph,
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>,
  typeMap: Map<string, { type: TypeGraph, file: FileGraph }>
): FileGraph {
  // First, check if the file needs casing fixed
  const sourceFileName = path.basename(file.path);
  const correctCaseFile = findCorrectCaseFile(file.path, codeGraph);

  if (correctCaseFile && correctCaseFile.path !== file.path) {
    file.path = correctCaseFile.path;
  }

  return {
    ...file,
    functions: file.functions.map(fn => ({
      ...fn,
      fileName: sourceFileName, // Ensure fileName matches the actual case
      callsTo: fn.callsTo || findFunctionCalls(fn, file, codeGraph, functionMap),
      calledBy: findFunctionCallers(fn, codeGraph, functionMap)
    })),
    componentHierarchy: file.componentHierarchy
      ? enhanceComponentHierarchy(file.componentHierarchy, file, codeGraph)
      : (file.path.endsWith('.jsx') || file.path.endsWith('.tsx') || file.path.endsWith('.js')
        ? buildComponentHierarchy(file, codeGraph, functionMap)
        : undefined),
    detailedDependencies: file.detailedDependencies || analyzeModuleDependencies(file, codeGraph)
  };
}

// Helper to find the file with correct case
function findCorrectCaseFile(filePath: string, codeGraph: CodeGraph): FileGraph | undefined {
  const basePath = path.dirname(filePath);
  const fileName = path.basename(filePath);

  for (const pkg of codeGraph.packages) {
    for (const file of pkg.files) {
      if (path.dirname(file.path) === basePath &&
        path.basename(file.path).toLowerCase() === fileName.toLowerCase()) {
        return file;
      }
    }
  }

  return undefined;
}

function enhanceComponentHierarchy(
  hierarchy: Record<string, { renders: string[], renderedBy: string[] }>,
  file: FileGraph,
  codeGraph: CodeGraph
): Record<string, { renders: string[], renderedBy: string[] }> {
  // Check if the hierarchy has the renderedBy property already
  const hasRenderedBy = Object.values(hierarchy).some(h => 'renderedBy' in h);

  // If it already has the full structure, return it
  if (hasRenderedBy) return hierarchy;

  // Otherwise, enhance it with renderedBy relationships
  const enhanced: Record<string, { renders: string[], renderedBy: string[] }> = {};

  // Initialize with existing renders
  Object.keys(hierarchy).forEach(component => {
    enhanced[component] = {
      renders: hierarchy[component].renders || [],
      renderedBy: []
    };
  });

  // Add renderedBy relationships
  Object.keys(enhanced).forEach(component => {
    const renders = enhanced[component].renders;
    renders.forEach(rendered => {
      if (enhanced[rendered]) {
        enhanced[rendered].renderedBy.push(component);
      } else {
        enhanced[rendered] = {
          renders: [],
          renderedBy: [component]
        };
      }
    });
  });

  return enhanced;
}

function buildFunctionMap(codeGraph: CodeGraph): Map<string, { function: FunctionGraph, file: FileGraph }> {
  const functionMap = new Map();

  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      file.functions.forEach(fn => {
        if (fn.name !== 'root') {
          // Store with qualified name (file:function)
          const qualifiedName = `${file.path}:${fn.name}`;
          functionMap.set(qualifiedName, { function: fn, file });

          // Also store by function name for simpler lookups
          // But only if there's no collision
          if (!functionMap.has(fn.name)) {
            functionMap.set(fn.name, { function: fn, file });
          }
        }
      });
    });
  });

  return functionMap;
}

function buildTypeMap(codeGraph: CodeGraph): Map<string, { type: TypeGraph, file: FileGraph }> {
  const typeMap = new Map();

  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      file.types.forEach(type => {
        // Store with qualified name (file:type)
        const qualifiedName = `${file.path}:${type.name}`;
        typeMap.set(qualifiedName, { type, file });

        // Also store by type name for simpler lookups
        // But only if there's no collision
        if (!typeMap.has(type.name)) {
          typeMap.set(type.name, { type, file });
        }
      });
    });
  });

  return typeMap;
}

function findFunctionCalls(
  fn: FunctionGraph,
  file: FileGraph,
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): string[] {
  // If the function already has callsTo from the parser, use it
  if (fn.callsTo && fn.callsTo.length > 0) {
    return fn.callsTo;
  }

  const calls: string[] = [];

  // For root function, extract from dependencies
  if (fn.name === 'root') {
    fn.dependencies.forEach(dep => {
      const importedName = Object.keys(dep)[0];
      if (functionMap.has(importedName)) {
        calls.push(importedName);
      }
    });
    return calls;
  }

  // For regular functions, look at dependencies
  if (fn.dependencies) {
    fn.dependencies.forEach(dep => {
      const importedName = Object.keys(dep)[0];
      if (functionMap.has(importedName)) {
        calls.push(importedName);
      }
    });
  }

  // Only add local functions that are likely to be called
  const localFunctions = file.functions
    .filter(otherFn => otherFn.name !== fn.name && otherFn.name !== 'root');

  // For each local function, check if it's referenced in the function
  localFunctions.forEach(localFn => {
    // Here we could have more sophisticated detection
    // But for now we'll trust the callsTo property from the parser
    if (fn.callsTo && fn.callsTo.includes(localFn.name)) {
      calls.push(localFn.name);
    }
  });

  // Find calls to imported functions from other files
  file.dependencies.forEach(dep => {
    const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
    if (depFile) {
      depFile.exports.forEach(exportName => {
        const exportedFn = depFile.functions.find(f => f.name === exportName);
        if (exportedFn) {
          // Check if this function calls the exported one
          const depKey = `${exportName}`;
          if (fn.dependencies && fn.dependencies.some(d => Object.keys(d)[0] === depKey)) {
            calls.push(exportName);
          }
          // Also check callsTo property
          if (fn.callsTo && fn.callsTo.includes(exportName)) {
            calls.push(exportName);
          }
        }
      });
    }
  });

  // Deduplicate
  return [...new Set(calls)];
}

function findFunctionCallers(
  fn: FunctionGraph,
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): string[] {
  const callers: string[] = [];

  if (fn.name === 'root') {
    return callers; // root is never called
  }

  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      const isExported = file.exports.includes(fn.name);
      const fileContainsFn = file.path === fn.fileName ||
        file.functions.some(f => f.name === fn.name);

      file.functions.forEach(potentialCaller => {
        // Skip if it's the same function or root
        if (potentialCaller.name === fn.name || potentialCaller.name === 'root') {
          return;
        }

        // Check if there's a direct call reference
        if (potentialCaller.callsTo && potentialCaller.callsTo.includes(fn.name)) {
          callers.push(`${file.path}:${potentialCaller.name}`);
          return;
        }

        // Check dependencies for imported function references
        if (isExported || fileContainsFn) {
          if (potentialCaller.dependencies && potentialCaller.dependencies.length > 0) {
            const callsFunction = potentialCaller.dependencies.some(dep => {
              const depName = Object.keys(dep)[0];
              return depName === fn.name;
            });

            if (callsFunction) {
              callers.push(`${file.path}:${potentialCaller.name}`);
            }
          }
        }
      });
    });
  });

  return callers;
}

function buildComponentHierarchy(
  file: FileGraph,
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): Record<string, { renders: string[], renderedBy: string[] }> {
  const componentHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};

  // Find components by looking for functions that start with capital letter
  // and (ideally) have a React component indicator
  const componentFunctions = file.functions.filter(fn => {
    // Either it's marked as a component, or it has a capital first letter
    const isComponent = fn.name.includes('(React Component)') ||
      (fn.name !== 'root' && /^[A-Z]/.test(fn.name));
    return isComponent;
  });

  // Initialize hierarchy
  componentFunctions.forEach(component => {
    // Clean up name (remove React Component suffix)
    const cleanName = component.name.replace(' (React Component)', '');
    componentHierarchy[cleanName] = {
      renders: [],
      renderedBy: []
    };
  });

  // Find imported components
  const importedComponents: Record<string, string> = {};
  file.dependencies.forEach(dep => {
    const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
    if (!depFile) return;

    depFile.exports.forEach(exportName => {
      // Likely a component if capitalized
      if (/^[A-Z]/.test(exportName)) {
        importedComponents[exportName] = depFile.path;
      }
    });
  });

  // Now determine actual component relationships based on:
  // 1. Function calls
  // 2. JSX usage (if available)
  componentFunctions.forEach(component => {
    const cleanName = component.name.replace(' (React Component)', '');

    // Use callsTo if available
    if (component.callsTo && component.callsTo.length > 0) {
      component.callsTo.forEach(calledName => {
        // Filter to components (start with capital letter)
        if (/^[A-Z]/.test(calledName)) {
          componentHierarchy[cleanName].renders.push(calledName);
        }
      });
    }

    // Look for dependencies that match imports
    if (component.dependencies) {
      component.dependencies.forEach(dep => {
        const depName = Object.keys(dep)[0];
        if (importedComponents[depName]) {
          componentHierarchy[cleanName].renders.push(depName);
        }
      });
    }

    // In the absence of clear JSX analysis, we can use component
    // hierarchy data from React parser if available
    if (file.componentHierarchy && file.componentHierarchy[cleanName]) {
      const existingRenders = file.componentHierarchy[cleanName].renders || [];
      componentHierarchy[cleanName].renders = [
        ...new Set([...componentHierarchy[cleanName].renders, ...existingRenders])
      ];
    }
  });

  // Build the renderedBy inverse relationships
  Object.keys(componentHierarchy).forEach(component => {
    const renders = componentHierarchy[component].renders;
    renders.forEach(rendered => {
      if (componentHierarchy[rendered]) {
        if (!componentHierarchy[rendered].renderedBy.includes(component)) {
          componentHierarchy[rendered].renderedBy.push(component);
        }
      } else {
        // Add entry for imported component that's rendered
        componentHierarchy[rendered] = {
          renders: [],
          renderedBy: [component]
        };
      }
    });
  });

  return componentHierarchy;
}

function analyzeModuleDependencies(
  file: FileGraph,
  codeGraph: CodeGraph
): Array<{ module: string, imports: string[] }> {
  const detailedDependencies: Array<{ module: string, imports: string[] }> = [];

  // If the file already has detailed dependencies, use them as a starting point
  if (file.detailedDependencies && file.detailedDependencies.length > 0) {
    return file.detailedDependencies;
  }

  file.dependencies.forEach(dep => {
    const imports: string[] = [];

    // Check all functions for dependencies on this module
    file.functions.forEach(fn => {
      if (fn.dependencies) {
        fn.dependencies.forEach(fnDep => {
          const importName = Object.keys(fnDep)[0];
          const importSource = fnDep[importName];
          if (importSource === dep) {
            imports.push(importName);
          }
        });
      }
    });

    // Create a record for this dependency
    detailedDependencies.push({
      module: dep,
      imports: [...new Set(imports)]
    });
  });

  return detailedDependencies;
}

function resolveImportPath(importerPath: string, importPath: string): string {
  // Handle absolute imports
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return importPath;
  }

  // Resolve relative path
  const importerDir = path.dirname(importerPath);
  let resolvedPath = path.normalize(path.join(importerDir, importPath)).replace(/\\/g, '/');

  // If the path doesn't have an extension, return it as is
  if (!path.extname(resolvedPath)) {
    return resolvedPath;
  }

  return resolvedPath;
}

function findFileByPath(codeGraph: CodeGraph, filePath: string): FileGraph | undefined {
  const normalizedPath = normalizePath(filePath);

  // Try exact match first
  for (const pkg of codeGraph.packages) {
    for (const file of pkg.files) {
      if (file.path === normalizedPath) {
        return file;
      }
    }
  }

  // Try case-insensitive match
  const lowerPath = normalizedPath.toLowerCase();
  for (const pkg of codeGraph.packages) {
    for (const file of pkg.files) {
      if (file.path.toLowerCase() === lowerPath) {
        return file;
      }
    }
  }

  // Try without extension
  const pathWithoutExt = normalizedPath.replace(/\.[^/.]+$/, '');
  for (const pkg of codeGraph.packages) {
    for (const file of pkg.files) {
      const filePathNoExt = file.path.replace(/\.[^/.]+$/, '');
      if (filePathNoExt === pathWithoutExt) {
        return file;
      }

      // Check common extensions
      const extensions = ['.js', '.jsx', '.ts', '.tsx'];
      for (const ext of extensions) {
        if (file.path === `${pathWithoutExt}${ext}`) {
          return file;
        }
      }
    }
  }

  return undefined;
}
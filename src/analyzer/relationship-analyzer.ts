// src/analyzer/relationship-analyzer.ts
import { CodeGraph, FileGraph, FunctionGraph, TypeGraph } from '../types/interfaces';
import path from 'path';

export function analyzeRelationships(codeGraph: CodeGraph): CodeGraph {
  // First pass - collect all declarations (already done by your current code)
  
  // Build lookup maps for faster relationship analysis
  const functionMap = buildFunctionMap(codeGraph);
  const typeMap = buildTypeMap(codeGraph);
  
  // Second pass - analyze relationships
  const enhancedGraph = {
    ...codeGraph,
    packages: codeGraph.packages.map(pkg => ({
      ...pkg,
      files: pkg.files.map(file => enhanceFileRelationships(file, codeGraph, functionMap, typeMap))
    }))
  };
  
  return enhancedGraph;
}

// In relationship-analyzer.ts, update enhanceFileRelationships function
function enhanceFileRelationships(
  file: FileGraph, 
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>,
  typeMap: Map<string, { type: TypeGraph, file: FileGraph }>
): FileGraph {
  // Enhanced file with relationship data
  return {
    ...file,
    functions: file.functions.map(fn => ({
      ...fn,
      callsTo: findFunctionCalls(fn, file, codeGraph, functionMap),
      calledBy: findFunctionCallers(fn, codeGraph, functionMap)
    })),
    // Enhance existing component hierarchy or create a new one
    componentHierarchy: file.componentHierarchy 
      ? enhanceComponentHierarchy(file.componentHierarchy, file, codeGraph)
      : (file.path.endsWith('.jsx') || file.path.endsWith('.tsx')
          ? buildComponentHierarchy(file, codeGraph, functionMap)
          : undefined),
    // Add detailed module dependencies
    detailedDependencies: analyzeModuleDependencies(file, codeGraph)
  };
}

// Add a new function to enhance existing component hierarchy
function enhanceComponentHierarchy(
  hierarchy: Record<string, { renders: string[] }>,
  file: FileGraph,
  codeGraph: CodeGraph
): Record<string, { renders: string[], renderedBy: string[] }> {
  const enhanced: Record<string, { renders: string[], renderedBy: string[] }> = {};
  
  // Convert the existing hierarchy to the enhanced format
  Object.keys(hierarchy).forEach(component => {
    enhanced[component] = {
      renders: hierarchy[component].renders,
      renderedBy: [] // Will be filled in below
    };
  });
  
  // Fill in the renderedBy relationships
  Object.keys(enhanced).forEach(component => {
    const renders = enhanced[component].renders;
    
    renders.forEach(rendered => {
      if (enhanced[rendered]) {
        enhanced[rendered].renderedBy.push(component);
      } else {
        // This component is rendered but not defined in this file
        enhanced[rendered] = {
          renders: [],
          renderedBy: [component]
        };
      }
    });
  });
  
  return enhanced;
}

/**
 * Build a map of all functions in the codebase for quick lookup
 */
function buildFunctionMap(codeGraph: CodeGraph): Map<string, { function: FunctionGraph, file: FileGraph }> {
  const functionMap = new Map();
  
  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      file.functions.forEach(fn => {
        if (fn.name !== 'root') { // Skip the synthetic root function
          // Use qualified name (file path + function name) for uniqueness
          const qualifiedName = `${file.path}:${fn.name}`;
          functionMap.set(qualifiedName, { function: fn, file });
          
          // Also store by simple name for potential lookups, but only if it doesn't cause collisions
          if (!functionMap.has(fn.name)) {
            functionMap.set(fn.name, { function: fn, file });
          }
        }
      });
    });
  });
  
  return functionMap;
}

/**
 * Build a map of all types in the codebase for quick lookup
 */
function buildTypeMap(codeGraph: CodeGraph): Map<string, { type: TypeGraph, file: FileGraph }> {
  const typeMap = new Map();
  
  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      file.types.forEach(type => {
        // Use qualified name (file path + type name) for uniqueness
        const qualifiedName = `${file.path}:${type.name}`;
        typeMap.set(qualifiedName, { type, file });
        
        // Also store by simple name for potential lookups
        if (!typeMap.has(type.name)) {
          typeMap.set(type.name, { type, file });
        }
      });
    });
  });
  
  return typeMap;
}

/**
 * Find which functions are called by the given function
 */
function findFunctionCalls(
  fn: FunctionGraph, 
  file: FileGraph, 
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): string[] {
  // This is an approximation based on function names in dependencies
  // In a real implementation, you would parse the function body to find actual calls
  
  const calls: string[] = [];
  
  // For root function, check imports
  if (fn.name === 'root') {
    fn.dependencies.forEach(dep => {
      // For each imported item, check if it's a function
      const importedName = Object.keys(dep)[0];
      if (functionMap.has(importedName)) {
        calls.push(importedName);
      }
    });
    return calls;
  }
  
  // For other functions, look for function names in the function's file
  const potentialCalls = file.functions
    .filter(otherFn => otherFn.name !== fn.name && otherFn.name !== 'root')
    .map(otherFn => otherFn.name);
  
  // Also check functions from imported modules
  file.dependencies.forEach(dep => {
    // Find the file this dependency refers to
    const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
    if (depFile) {
      depFile.exports.forEach(exportName => {
        // Check if the export is a function
        const exportedFn = depFile.functions.find(f => f.name === exportName);
        if (exportedFn) {
          potentialCalls.push(exportName);
        }
      });
    }
  });
  
  // Filter potential calls to those that are likely called
  // This is a heuristic, not perfect but reasonable
  return potentialCalls.filter(name => {
    // Check if the function body likely contains a call to this function
    // Ideally we'd parse the function body, but we'll use a simpler heuristic
    return functionMap.has(name);
  });
}

/**
 * Find which functions call the given function
 */
function findFunctionCallers(
  fn: FunctionGraph, 
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): string[] {
  const callers: string[] = [];
  
  // Skip root function
  if (fn.name === 'root') {
    return callers;
  }
  
  // Check all functions in the codebase to see if they might call this function
  codeGraph.packages.forEach(pkg => {
    pkg.files.forEach(file => {
      // If this function is exported from its file
      const isExported = file.exports.includes(fn.name);
      
      file.functions.forEach(potentialCaller => {
        // Skip self-references and root
        if (potentialCaller.name === fn.name || potentialCaller.name === 'root') {
          return;
        }
        
        // Check if the caller imports this function (if it's exported)
        if (isExported) {
          const callsImportedFunction = potentialCaller.dependencies.some(dep => 
            Object.keys(dep).includes(fn.name)
          );
          
          if (callsImportedFunction) {
            callers.push(`${file.path}:${potentialCaller.name}`);
          }
        }
        
        // For functions in the same file, use name matching heuristic
        if (file.path === fn.fileName) {
          // Simple heuristic: assume functions in the same file might call each other
          callers.push(`${file.path}:${potentialCaller.name}`);
        }
      });
    });
  });
  
  return callers;
}

/**
 * Analyze JSX/TSX files to determine component hierarchy
 */
function buildComponentHierarchy(
  file: FileGraph, 
  codeGraph: CodeGraph,
  functionMap: Map<string, { function: FunctionGraph, file: FileGraph }>
): Record<string, { renders: string[], renderedBy: string[] }> {
  const componentHierarchy: Record<string, { renders: string[], renderedBy: string[] }> = {};
  
  // First identify all component functions in this file
  const componentFunctions = file.functions.filter(fn => 
    // React components typically start with uppercase letters
    fn.name !== 'root' && /^[A-Z]/.test(fn.name)
  );
  
  // Initialize hierarchy entries
  componentFunctions.forEach(component => {
    componentHierarchy[component.name] = {
      renders: [],
      renderedBy: []
    };
  });
  
  // Use imports to find potential rendered components
  const importedComponents: Record<string, string> = {};
  
  file.dependencies.forEach(dep => {
    const depFile = findFileByPath(codeGraph, resolveImportPath(file.path, dep));
    if (!depFile) return;
    
    // Check exports of the dependency
    depFile.exports.forEach(exportName => {
      // If export starts with uppercase, it might be a component
      if (/^[A-Z]/.test(exportName)) {
        importedComponents[exportName] = depFile.path;
      }
    });
  });
  
  // For each component, determine which components it might render
  componentFunctions.forEach(component => {
    // Component can render other components from this file
    componentFunctions.forEach(potentialChild => {
      if (component.name !== potentialChild.name) {
        // Simple heuristic: component potentially renders all other components
        componentHierarchy[component.name].renders.push(potentialChild.name);
        
        // Update the rendered-by relationship too
        if (componentHierarchy[potentialChild.name]) {
          componentHierarchy[potentialChild.name].renderedBy.push(component.name);
        }
      }
    });
    
    // Component can render imported components
    Object.keys(importedComponents).forEach(importedComponent => {
      componentHierarchy[component.name].renders.push(importedComponent);
    });
  });
  
  return componentHierarchy;
}

/**
 * Analyze cross-module dependencies in detail
 */
function analyzeModuleDependencies(
  file: FileGraph, 
  codeGraph: CodeGraph
): Array<{ module: string, imports: string[] }> {
  const detailedDependencies: Array<{ module: string, imports: string[] }> = [];
  
  file.dependencies.forEach(dep => {
    const imports: string[] = [];
    
    // Look for imports in function dependencies
    file.functions.forEach(fn => {
      fn.dependencies.forEach(fnDep => {
        const importName = Object.keys(fnDep)[0];
        const importSource = fnDep[importName];
        
        if (importSource === dep) {
          imports.push(importName);
        }
      });
    });
    
    // If we found specific imports, add them
    if (imports.length > 0) {
      detailedDependencies.push({
        module: dep,
        imports: [...new Set(imports)] // Remove duplicates
      });
    } else {
      // No specific imports found, but the dependency exists
      detailedDependencies.push({
        module: dep,
        imports: []
      });
    }
  });
  
  return detailedDependencies;
}

/**
 * Resolve import path relative to the importing file
 */
function resolveImportPath(importerPath: string, importPath: string): string {
  // Skip node_modules imports
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return importPath;
  }
  
  const importerDir = path.dirname(importerPath);
  let resolvedPath = path.join(importerDir, importPath);
  
  // If there's no extension, try common extensions
  if (!path.extname(resolvedPath)) {
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      const withExt = `${resolvedPath}${ext}`;
      // We can't actually check file existence here, so we'll just return with extension
      return withExt;
    }
  }
  
  return resolvedPath;
}

/**
 * Find a file by its path
 */
function findFileByPath(codeGraph: CodeGraph, filePath: string): FileGraph | undefined {
  for (const pkg of codeGraph.packages) {
    for (const file of pkg.files) {
      // Try exact match first
      if (file.path === filePath) {
        return file;
      }
      
      // Try matching without extension
      const filePathNoExt = file.path.replace(/\.[^/.]+$/, "");
      const searchPathNoExt = filePath.replace(/\.[^/.]+$/, "");
      
      if (filePathNoExt === searchPathNoExt) {
        return file;
      }
      
      // Try matching with normalized path
      const normalizedFilePath = file.path.replace(/\\/g, '/');
      const normalizedSearchPath = filePath.replace(/\\/g, '/');
      
      if (normalizedFilePath === normalizedSearchPath) {
        return file;
      }
    }
  }
  
  return undefined;
}
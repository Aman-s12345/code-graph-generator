// Top-level code graph for a project
interface CodeGraph {
    files: FileDef[];
  }
  
  // Representation of one source file
  interface FileDef {
    path: string;                 // e.g. "src/utils.js"
    imports: ImportDecl[];        // import or require statements
    exports: ExportDecl[];        // export declarations
    functions: FunctionDef[];     // free (top-level) functions
    variables: VariableDef[];     // top-level variables (var/let/const)
    classes: ClassDef[];          // class definitions
    components: ReactComponentDef[]; // React component definitions
    references: Reference[];      // cross-file symbol references/usage
  }
  
  // Import declaration (ESM or CommonJS)
  interface ImportDecl {
    source: string;               // module path or name, e.g. "./utils"
    defaultImport?: string;       // name of default import, if any
    namespaceImport?: string;     // local name for `* as ns`, if any
    namedImports?: {              // list of named imports
      importedName: string;       // exported name in source
      localName: string;          // local alias (same as importedName if no alias)
    }[];
    requireVar?: string;          // for CommonJS: local var e.g. `const fs = require('fs')`
  }
  
  // Export declaration
  interface ExportDecl {
    kind: 'named' | 'default' | 'all'; 
    // - named: `export { a }` or `export function f`  
    // - default: `export default ...`  
    // - all: wildcard (re-export) `export *` or `export * as name`
    name?: string;                // local name being exported
    alias?: string;               // exported alias (for `as`)
    source?: string;              // for `export ... from "mod"` (re-export source)
  }
  
  // Function definition
  interface FunctionDef {
    name: string;                 // function name (or empty for anonymous default export)
    params: Parameter[];
    returnType?: string;          // if inferrable (TypeScript or JSDoc)
    doc?: string;                 // attached comments or JSDoc
    async?: boolean;              // if async function
    generator?: boolean;          // if generator function
    exported?: boolean;           // true if this function is exported
    defaultExport?: boolean;      // true if exported as default
  }
  
  // Function parameter
  interface Parameter {
    name: string;
    type?: string;                // inferred or annotated type
    defaultValue?: string;        // if a default value is given
  }
  
  // Variable definition (top-level)
  interface VariableDef {
    name: string;
    kind: 'var' | 'let' | 'const';
    type?: string;                // inferred/annotated type
    value?: string;               // initial value (as string or AST)
    exported?: boolean;
  }
  
  // Class definition
  interface ClassDef {
    name: string;
    extends?: string;             // base class name, if any
    methods: FunctionDef[];       // methods (non-React methods)
    exported?: boolean;
    defaultExport?: boolean;
    doc?: string;                 // class-level comment
  }
  
  // React component (functional or class-based)
  interface ReactComponentDef {
    name: string;
    componentType: 'functional' | 'class'; 
    props?: string[];             // prop names or types
    doc?: string;                 // documentation or docstring
    exported?: boolean;
    defaultExport?: boolean;
  }
  
  // Reference between symbols (calls, imports, etc.)
  interface Reference {
    from: SymbolRef;              // usage site
    to: SymbolRef;                // definition site
    kind: 'calls' | 'imports' | 'extends' | 'implements' | 'uses';
  }
  
  // Symbol identifier
  interface SymbolRef {
    file: string;                 // file path where symbol appears
    name: string;                 // symbol name
    symbolType: 'function' | 'variable' | 'class' | 'component';
  }
  
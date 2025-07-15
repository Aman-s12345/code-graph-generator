// // src/utils/ast-utils.ts
/**
 * Gets the starting line number of an AST node.
 * @param node The AST node
 * @returns The line number or 0 if not available
 */
export function getStartLine(node: any): number {
    if (node?.loc?.start?.line) {
        return node.loc.start.line;
    }
    return 0;
}

/**
 * Counts the number of lines in a text.
 * @param text The text to count lines in
 * @returns The number of lines
 */
export function countLines(text: string): number {
    if (!text) return 0;
    return text.split('\n').length;
}

/**
 * Extracts function names from an AST node.
 * @param node The AST node
 * @returns Array of function names
 */
export function extractFunctionNames(node: any): string[] {
    const names: string[] = [];
    if (!node) return names;

    // Function declaration
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
        names.push(node.id.name);
    }

    // Variable declarations with function expressions
    if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
            if (declaration.init) {
                if (
                    declaration.init.type === 'FunctionExpression' ||
                    declaration.init.type === 'ArrowFunctionExpression'
                ) {
                    if (declaration.id?.name) {
                        names.push(declaration.id.name);
                    }
                }
            }
        }
    }

    // Class methods
    if (node.type === 'ClassDeclaration' && node.body?.body) {
        for (const member of node.body.body) {
            if (member.type === 'MethodDefinition' && member.key?.name) {
                names.push(member.key.name);
            }
        }
    }

    return names;
}

/**
 * Normalizes a file path to use forward slashes.
 * @param filePath The file path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return '';
  
  // Only normalize separators, preserve case
  return filePath.replace(/\\/g, '/');
}
export async function getCorrectCasePath(basePath: string, filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const normalizedPath = normalizePath(filePath);
    
    // Try to find the correct case in the parent directory
    const dir = path.dirname(path.join(basePath, normalizedPath));
    const filename = path.basename(normalizedPath);
    
    // Read the directory
    const files = await fs.readdir(dir);
    
    // Find the correct case
    const correctName = files.find(f => f.toLowerCase() === filename.toLowerCase());
    
    // If found, return with correct case
    if (correctName) {
      return normalizePath(path.join(path.dirname(normalizedPath), correctName));
    }
    
    // Fall back to the original
    return normalizedPath;
  } catch (error) {
    // If any error, just return the normalized path
    return normalizePath(filePath);
  }
}

// Legacy alias for normalizePath for backward compatibility
export const toPosixPath = normalizePath;

/**
 * Traverses an AST and calls visitor functions for specific node types.
 * @param node The AST node to traverse
 * @param visitors Object mapping node types to visitor functions
 * @param visited Optional Set to prevent circular references
 */
export function lightTraverse(
    node: any,
    visitors: Record<string, (node: any) => void>,
    visited: Set<any> = new Set()
): void {
    if (!node || typeof node !== 'object' || visited.has(node)) return;

    // Mark this node as visited to avoid circular references
    visited.add(node);

    try {
        if (node.type && visitors[node.type]) {
            visitors[node.type](node);
        }

        for (const key of Object.keys(node)) {
            const child = node[key];

            // Skip metadata properties
            if (key === 'loc' || key === 'range' || key === 'parent') continue;

            if (Array.isArray(child)) {
                for (const item of child) {
                    lightTraverse(item, visitors, visited);
                }
            } else if (child && typeof child === 'object') {
                lightTraverse(child, visitors, visited);
            }
        }
    } catch (error) {
        console.error(`Error traversing node of type ${node.type}:`, error);
    }
}

/**
 * Builds a map of child nodes to their parent nodes.
 * @param node The root AST node
 * @param parent The parent node (null for root)
 * @returns Map of nodes to their parents
 */
export function buildParentMap(node: any, parent: any = null): Map<any, any> {
    const parentMap = new Map();
    const visited = new Set();

    const addParent = (childNode: any, parentNode: any) => {
        if (!childNode || typeof childNode !== 'object' || visited.has(childNode)) return;

        visited.add(childNode);
        parentMap.set(childNode, parentNode);

        for (const key in childNode) {
            if (childNode.hasOwnProperty(key) &&
                key !== 'loc' && key !== 'range' && key !== 'parent') {
                const grandchild = childNode[key];
                if (grandchild && typeof grandchild === 'object') {
                    if (Array.isArray(grandchild)) {
                        grandchild.forEach(item => addParent(item, childNode));
                    } else {
                        addParent(grandchild, childNode);
                    }
                }
            }
        }
    };

    addParent(node, parent);
    return parentMap;
}

/**
 * Traverses an AST with parent and grandparent context.
 * @param ast The AST to traverse
 * @param visitors Object mapping node types to visitor functions
 */
export function lightTraverseWithParents(
    ast: any,
    visitors: Record<string, (node: any, parent: any, grandparent: any) => void>
): void {
    const visited = new Set();

    function visit(node: any, parent: any = null, grandparent: any = null) {
        if (!node || typeof node !== 'object' || visited.has(node)) return;

        visited.add(node);

        try {
            if (node.type && visitors[node.type]) {
                visitors[node.type](node, parent, grandparent);
            }

            for (const key of Object.keys(node)) {
                const child = node[key];

                if (key === 'loc' || key === 'range') continue;

                if (Array.isArray(child)) {
                    for (const item of child) {
                        visit(item, node, parent);
                    }
                } else if (child && typeof child === 'object') {
                    visit(child, node, parent);
                }
            }
        } catch (error) {
            console.error(`Error traversing node of type ${node.type} with parents:`, error);
        }
    }

    visit(ast);
}
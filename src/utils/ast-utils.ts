
export function getStartLine(node: any): number {
    if (node.loc && node.loc.start && node.loc.start.line) {
        return node.loc.start.line;
    }
    return 0;
}


export function countLines(text: string): number {
    if (!text) return 0;
    return text.split('\n').length;
}


export function extractFunctionNames(node: any): string[] {
    const names: string[] = [];

    if (!node) return names;


    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
        names.push(node.id.name);
    }


    if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
            if (declaration.init) {
                if (
                    declaration.init.type === 'FunctionExpression' ||
                    declaration.init.type === 'ArrowFunctionExpression'
                ) {
                    if (declaration.id && declaration.id.name) {
                        names.push(declaration.id.name);
                    }
                }
            }
        }
    }

    return names;
}


export function toPosixPath(filePath: string): string {
    return filePath.split('\\').join('/');
}

export function lightTraverse(node: any, visitors: Record<string, (node: any) => void>): void {
    if (!node || typeof node !== 'object') return;


    if (node.type && visitors[node.type]) {
        visitors[node.type](node);
    }


    for (const key of Object.keys(node)) {
        const child = node[key];

        if (key === 'loc' || key === 'range' || key === 'parent') continue;

        if (Array.isArray(child)) {
            for (const item of child) {
                lightTraverse(item, visitors);
            }
        } else {
            lightTraverse(child, visitors);
        }
    }
}


export function buildParentMap(node: any, parent: any = null): Map<any, any> {
    const parentMap = new Map();

    const addParent = (childNode: any, parentNode: any) => {
        if (childNode && typeof childNode === 'object') {
            parentMap.set(childNode, parentNode);

            for (const key in childNode) {
                if (childNode.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'parent') {
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
        }
    };

    addParent(node, parent);
    return parentMap;
}

// src/utils/ast-utils.ts
export function lightTraverseWithParents(
    ast: any,
    visitors: Record<string, (node: any, parent: any, grandparent: any) => void>
): void {
    function visit(node: any, parent: any = null, grandparent: any = null) {
        if (!node || typeof node !== 'object') return;

        // Call the appropriate visitor if available
        if (node.type && visitors[node.type]) {
            visitors[node.type](node, parent, grandparent);
        }

        // Recursively visit all properties
        for (const key of Object.keys(node)) {
            const child = node[key];

            // Skip non-object properties and specific fields that aren't part of the AST
            if (key === 'loc' || key === 'range') continue;

            if (Array.isArray(child)) {
                for (const item of child) {
                    visit(item, node, parent);
                }
            } else if (child && typeof child === 'object') {
                visit(child, node, parent);
            }
        }
    }

    visit(ast);
}
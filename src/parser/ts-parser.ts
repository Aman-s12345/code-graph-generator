import { parse } from '@babel/parser';
import path from 'path';
import { FileGraph, FileParser, TypeGraph, MemberGraph } from '../types/interfaces';
import { getStartLine, countLines } from '../utils/ast-utils';
import { logger } from '../utils/file-utils';
import { createJsParser } from './js-parser';


export function createTsParser(): FileParser {
    const jsParser = createJsParser();

    return {
        async parse(filePath: string, content: string): Promise<FileGraph> {
            logger.debug(`TS Parser: parsing ${filePath}`);

            const fileGraph = await jsParser.parse(filePath, content);

            try {

                const ast = parse(content, {
                    sourceType: 'module',
                    plugins: ['typescript', 'classProperties', 'dynamicImport', 'objectRestSpread', 'optionalChaining', 'decorators-legacy'],
                    errorRecovery: true,
                });

                extractTypeDefinitions(ast, fileGraph, filePath);

                return fileGraph;
            } catch (error) {
                logger.warn(`TypeScript parsing failed for ${filePath}, using JS parser result:`, error);
                return fileGraph;
            }
        }
    };
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


function lightTraverse(node: any, visitors: Record<string, (node: any) => void>): void {
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
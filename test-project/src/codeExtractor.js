// src/codeExtractor.js
import { TypeScriptCodeMapper } from '@traversets/code-extractor';
import ts from 'typescript';

const codeMapper = new TypeScriptCodeMapper();

/**
 * Gets all root file names from your TS/JS project.
 */
export function getRootFiles() {
  return codeMapper.getRootFileNames();
}

/**
 * Given a file path (one of the root files), returns its TS source AST.
 * @param {string} filePath
 */
export function getSourceFile(filePath) {
  return codeMapper.getSourceFile(filePath);
}

/**
 * Returns a list of dependencies (other files) for the given source file.
 * @param {ts.SourceFile} sourceFile
 */
export function getSourceFileDependencies(sourceFile) {
  return codeMapper.buildDependencyGraph(sourceFile);
}

/**
 * Builds a full codebase map (async).
 * @returns {Promise<Map<string, ts.SourceFile>>}
 */
export async function buildCodebaseMap() {
  const result = await codeMapper.buildCodebaseMap().getValue();
  return result; // a Map of filePath -> SourceFile
}

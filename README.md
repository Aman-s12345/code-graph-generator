# Code Graph Generator

Generate detailed code structure graphs for JavaScript/TypeScript projects.

## Features

- Analyze JS, TS, JSX, and TSX files
- Detect React components and their relationships
- Track function calls and dependencies
- Identify module imports/exports
- Analyze React hooks usage
- Memory-efficient for large codebases

## Installation

```bash
npm install code-graph-generator

## Uses

import { createCodeGraph } from 'code-graph-generator';

const graph = await createCodeGraph({
  projectName: 'My Project',
  rootDir: './src',
  includeDeclarations: false,
  concurrency: 10
});

console.log(JSON.stringify(graph, null, 2));


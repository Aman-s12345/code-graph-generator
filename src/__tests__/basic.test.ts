// src/__tests__/basic.test.ts
import { createCodeGraph } from '../index';
import path from 'path';

describe('Code Graph Generator', () => {
  test('should generate basic graph', async () => {
    const graph = await createCodeGraph({
      projectName: 'Test',
      rootDir: path.join(__dirname, 'fixtures/basic')
    });
    
    expect(graph.name).toBe('Test');
    expect(graph.packages.length).toBeGreaterThan(0);
  });
  
  test('should detect React components', async () => {
    const graph = await createCodeGraph({
      projectName: 'Test',
      rootDir: path.join(__dirname, 'fixtures/react')
    });
    
    const components = graph.packages
      .flatMap(pkg => pkg.files)
      .flatMap(file => file.functions)
      .filter(fn => fn.name.includes('React Component'));
    
    expect(components.length).toBeGreaterThan(0);
  });
});
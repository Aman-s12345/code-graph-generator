const { createCodeGraph } = require('./dist/index');

async function main() {
  console.time('Code Graph Generation');
  
  try {
    const graph = await createCodeGraph({
      projectName: 'Test Project',
      rootDir: './test-project', // Path to your test project
      include: ['**/*.js', '**/*.ts', '**/*.tsx','**/*.tsx'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      concurrency: 5,
      debug: true,
      outputPath: './output/code-graph.json'
    });
    
    console.log(`Generated graph with ${graph.packages.length} packages`);
  } catch (error) {
    console.error('Error generating code graph:', error);
  }
  
  console.timeEnd('Code Graph Generation');
}

main();
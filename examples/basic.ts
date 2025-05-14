
import { createCodeGraph } from '../src/index';
import path from 'path';

async function runExample() {
  const graph = await createCodeGraph({
    projectName: 'Example Project',
    rootDir: path.join(__dirname, '../test-project'),
    debug: true
  });
  
  console.log(JSON.stringify(graph, null, 2));
}

runExample().catch(console.error);
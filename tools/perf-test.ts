// tools/perf-test.ts
import { createCodeGraph } from '../src/index';
import path from 'path';
import fs from 'fs';

// Define an interface for our performance results
interface PerfResult {
  project: string;
  duration: string;
  memory: string;
}

async function runPerformanceTest() {
  // Test directories of increasing size
  const testDirs = [
    { name: 'small', path: '../test-project' },
  ];
  
  // Initialize with the correct type
  const results: PerfResult[] = [];
  
  for (const dir of testDirs) {
    const startMemory = process.memoryUsage().heapUsed;
    console.log(`Testing ${dir.name} project...`);
    
    const startTime = Date.now();
    await createCodeGraph({
      projectName: dir.name,
      rootDir: dir.path,
      outputPath: `./perf-results/${dir.name}-graph.json`
    });
    const duration = Date.now() - startTime;
    
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsage = endMemory - startMemory;
    
    results.push({
      project: dir.name,
      duration: `${duration}ms`,
      memory: `${Math.round(memoryUsage / 1024 / 1024)}MB`
    });
  }
  
  console.table(results);
}

runPerformanceTest();
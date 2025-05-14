// src/components/CodeGraph.jsx
import React, { useEffect, useState } from 'react';
import {
  getRootFiles,
  getSourceFile,
  getSourceFileDependencies,
  buildCodebaseMap,
} from './codeExtractor';

export default function CodeGraph() {
  const [roots, setRoots] = useState([]);
  const [deps, setDeps]   = useState({});
  const [mapSize, setMapSize] = useState(0);

  useEffect(() => {
    (async () => {
      const rootFiles = getRootFiles();
      setRoots(rootFiles);

      // pick the first root file for demo
      if (rootFiles.length) {
        const sf = getSourceFile(rootFiles[0]);
        setDeps({ [rootFiles[0]]: getSourceFileDependencies(sf) });
      }

      const codebase = await buildCodebaseMap();
      setMapSize(codebase.size);
    })();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Codebase Overview</h2>
      <p>Root files ({roots.length}):</p>
      <ul className="list-disc list-inside">
        {roots.map((r) => <li key={r}>{r}</li>)}
      </ul>

      <h3 className="mt-4 font-semibold">Dependencies of {roots[0]}</h3>
      <ul className="list-disc list-inside">
        {(deps[roots[0]] || []).map((d) => <li key={d}>{d}</li>)}
      </ul>

      <p className="mt-4">Total files in codebase: {mapSize}</p>
    </div>
  );
}

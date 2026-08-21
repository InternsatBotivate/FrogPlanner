import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname);

/**
 * Fail the build if a relative import escapes this repository.
 *
 * A cross-repo import once shipped to production undetected: Home.jsx and
 * Login.jsx did `import ... from '../../../../FrogPlanner_App/assets/...'`,
 * reaching into the sibling mobile repo. That resolves on a dev machine where
 * both repos sit side by side, so `npm run build` passed locally — but Vercel
 * clones only this repo, so the deploy failed with UNRESOLVED_IMPORT.
 *
 * Implemented as a source scan in buildStart rather than a resolveId hook:
 * with enforce:'post' the hook is never reached (Vite's own resolver handles
 * the id first), and enforce:'pre' would mean re-implementing Vite's
 * resolution to decide what's legitimate. Scanning the files we own is both
 * simpler and unambiguous.
 */
function noOutOfRootImports() {
  const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full, out);
      } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  return {
    name: 'no-out-of-root-imports',
    buildStart() {
      const offenders = [];
      for (const file of walk(path.join(projectRoot, 'src'))) {
        const code = fs.readFileSync(file, 'utf8');
        for (const m of code.matchAll(IMPORT_RE)) {
          const spec = m[1] || m[2];
          if (!spec) continue;
          const resolved = path.resolve(path.dirname(file), spec);
          if (!resolved.startsWith(projectRoot + path.sep)) {
            offenders.push({ file: path.relative(projectRoot, file), spec });
          }
        }
      }
      if (offenders.length) {
        const detail = offenders.map((o) => `  ${o.file}\n    imports: ${o.spec}`).join('\n');
        this.error(
          `${offenders.length} import(s) escape the project root. These build locally but ` +
            `FAIL on Vercel, which clones only this repository:\n${detail}\n` +
            `Copy the file into this repo (e.g. src/Assets/) and import it from there.`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), noOutOfRootImports()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'recharts',
      'date-fns'
    ]
  },
  server: {
    host: true,
    port: 3000
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true
  }
});
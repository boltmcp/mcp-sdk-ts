// Rewrites @modelcontextprotocol/server → @boltmcp/mcp-sdk-server in built dist output.
// Called from the modified prepack script. Only rewrites when package.json name has
// already been changed to the fork name (i.e., during publish-fork.sh), so normal
// `pnpm pack` (e.g., in tests) is not affected.

const fs = require('fs');
const path = require('path');

const OLD = '@modelcontextprotocol/server';
const NEW = '@boltmcp/mcp-sdk-server';

// Guard: only rewrite if package.json name is the fork name.
// publish-fork.sh rewrites the name before npm pack/publish triggers prepack.
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
if (!pkg.name.startsWith('@boltmcp/')) {
  console.log('  rewrite-fork-imports: skipping (package name is not fork name)');
  process.exit(0);
}

const distDir = path.resolve('dist');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      const updated = content.replaceAll(OLD, NEW);
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated);
        console.log(`  rewritten: ${path.relative(distDir, fullPath)}`);
      }
    }
  }
}

walk(distDir);

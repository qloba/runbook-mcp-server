#!/usr/bin/env node

// @ts-check

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import process from 'process';

async function buildMcpb() {
  console.log('Building .mcpb file...');

  // Ensure dist directory exists and is built
  if (!fs.existsSync('dist')) {
    console.log('Building TypeScript...');
    execSync('pnpm run build', { stdio: 'inherit' });
  }

  // Create output directory
  const outputDir = 'mcpb-output';
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir);

  // Create temp directory for production build
  const tempDir = path.join(outputDir, 'temp-build');
  fs.mkdirSync(tempDir);

  // Read package.json for version info
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  const mcpbFileName = path.join(
    outputDir,
    `runbook-mcp-server-${version}.mcpb`
  );

  // Update manifest.json version to match package.json
  console.log('Updating manifest.json version...');
  const manifestPath = 'manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Copy necessary files to temp directory
  console.log('Copying files to temporary build directory...');
  const filesToCopy = [
    'dist',
    'manifest.json',
    'package.json',
    'pnpm-lock.yaml',
    'icon.png',
    'README.md',
    'LICENSE'
  ];
  for (const file of filesToCopy) {
    const srcPath = path.resolve(file);
    const destPath = path.join(tempDir, path.basename(file));
    if (fs.lstatSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Install packages
  execSync(
    `pnpm --prefix ${tempDir} install --prod --frozen-lockfile --shamefully-hoist`,
    {
      stdio: 'inherit'
    }
  );

  execSync(`pnpm mcpb pack ${tempDir} ${mcpbFileName}`, {
    stdio: 'inherit'
  });
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildMcpb().catch((err) => {
    console.error('Error building .mdpb file:', err);
    process.exit(1);
  });
}

export default buildMcpb;

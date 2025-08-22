#!/usr/bin/env node

// @ts-check

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';
import process from 'process';

async function buildDxt() {
  console.log('Building .dxt file...');

  // Ensure dist directory exists and is built
  if (!fs.existsSync('dist')) {
    console.log('Building TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // Create output directory
  const outputDir = 'dxt-output';
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
  const dxtFileName = `runbook-mcp-server-${version}.dxt`;

  // Update manifest.json version to match package.json
  console.log('Updating manifest.json version...');
  const manifestPath = 'manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Create zip archive
  const output = fs.createWriteStream(path.join(outputDir, dxtFileName));
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  return new Promise(
    /** @param {(value?: any) => void} resolve @param {(reason?: any) => void} reject */ (
      resolve,
      reject
    ) => {
      output.on('close', () => {
        console.log(
          `✅ .dxt file created: ${dxtFileName} (${archive.pointer()} bytes)`
        );
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Copy necessary files to temp directory and install production dependencies
      console.log('Preparing production build...');
      fs.copyFileSync('package.json', path.join(tempDir, 'package.json'));
      fs.copyFileSync(
        'package-lock.json',
        path.join(tempDir, 'package-lock.json')
      );

      // Install production dependencies in temp directory
      console.log('Installing production dependencies...');
      execSync('npm ci --omit=dev --ignore-scripts', {
        stdio: 'inherit',
        cwd: tempDir
      });

      // Add manifest.json
      archive.file('manifest.json', { name: 'manifest.json' });

      // Add built server files
      archive.directory('dist/', 'dist/');

      // Add production node_modules from temp directory
      archive.directory(path.join(tempDir, 'node_modules'), 'node_modules/');

      // Add package.json
      archive.file('package.json', { name: 'package.json' });

      // Add README if it exists
      if (fs.existsSync('README.md')) {
        archive.file('README.md', { name: 'README.md' });
      }

      // Add icon if it exists
      if (fs.existsSync('icon.png')) {
        archive.file('icon.png', { name: 'icon.png' });
      }

      // Finalize the archive
      archive.finalize();
    }
  ).finally(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildDxt().catch((err) => {
    console.error('Error building .dxt file:', err);
    process.exit(1);
  });
}

export default buildDxt;

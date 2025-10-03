#!/usr/bin/env node

/**
 * Run the modified AEM import helper with our custom filename logic
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to our modified AEM import helper
const modifiedHelperPath = path.join(__dirname, 'aem-import-helper-working', 'src', 'bin.js');

// Command arguments
const args = [
  'da', 'upload',
  '--org', 'audemars-piguet',
  '--site', 'biencommun-fondationsaudemarspiguet',
  '--asset-list', '/Users/meejain/Desktop/XC/foundation/bien/asset-list.json',
  '--da-folder', '/Users/meejain/Desktop/XC/foundation/bien/da',
  '--keep'
];

console.log('🚀 Running Modified AEM Import Helper');
console.log(`📂 Using: ${modifiedHelperPath}`);
console.log(`📋 Command: node ${modifiedHelperPath} ${args.join(' ')}\n`);

// Run the modified helper
const child = spawn('node', [modifiedHelperPath, ...args], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  console.log(`\n🏁 Process exited with code ${code}`);
  if (code === 0) {
    console.log('✅ Upload completed successfully with unique filenames!');
  } else {
    console.log('❌ Upload failed');
  }
});

child.on('error', (err) => {
  console.error('❌ Error running modified AEM helper:', err);
});

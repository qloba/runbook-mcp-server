#!/usr/bin/env node

import readline from 'readline';
import { saveConfig } from './config';
import { runServer } from './server';

const args = process.argv.slice(2);

const ask = (query: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const setConfig = async () => {
  const baseUrl = (await ask('Enter base URL: ')) || '';
  const apiToken = (await ask('Enter API token: ')) || '';

  saveConfig({ baseUrl, apiToken });
};

if (args.includes('--init')) {
  setConfig().then(() => {
    console.log('Configuration saved.');
    process.exit(0);
  });
} else {
  runServer().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
  });
}

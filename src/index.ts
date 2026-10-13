#!/usr/bin/env node

import { buildServer } from './server';
import Config from './config';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const config = new Config();
console.error(`Base URL ${config.baseUrl}. Starting server.`);

// serveStdio picks the protocol era from the client's opening message:
// 2026-07-28 clients get a modern connection, 2025-era clients are still
// served through the initialize handshake.
const handle = serveStdio(() =>
  buildServer({
    name: config.prefix || 'runbook',
    baseUrl: config.baseUrl,
    accessToken: config.apiToken
  })
);

process.on('SIGINT', () => {
  void handle.close();
});

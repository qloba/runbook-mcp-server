#!/usr/bin/env node

// @ts-check

// Smoke test for the built server (dist/index.js). Each check spawns the
// server over stdio through the MCP Inspector CLI and asserts on the wire
// result and exit code. No Runbook API is reached: the base URL points at a
// closed local port, so only checks that fail before or at the API call are
// included here.

import fs from 'fs';
import { execFile } from 'child_process';
import process from 'process';

const INSPECTOR = '@modelcontextprotocol/inspector@2.9.0';
const BASE_URL = 'http://127.0.0.1:9';

const EXPECTED_TOOLS = [
  'search-articles',
  'get-article',
  'list-articles',
  'create-article',
  'update-article',
  'list-books',
  'list-categories',
  'get-folder',
  'list-assigned-processes',
  'get-process',
  'run-process',
  'upload-run-state-file'
];

/**
 * Run one Inspector CLI request against dist/index.js.
 * @param {string[]} args Inspector flags (--method etc.)
 * @param {Record<string, string>} [env] extra RUNBOOK_* variables for the server
 * @returns {Promise<{ code: number, json: any, error: any, stderr: string }>}
 */
function inspect(args, env = {}) {
  const serverEnv = {
    RUNBOOK_BASE_URL: BASE_URL,
    RUNBOOK_API_TOKEN: 'dummy',
    ...env
  };
  const envFlags = Object.entries(serverEnv).flatMap(([k, v]) => [
    '-e',
    `${k}=${v}`
  ]);
  // Env flags must follow the server command; placed before it, the Inspector
  // falls back to ./mcp.json and asks for --server.
  const argv = [
    '-y',
    INSPECTOR,
    '--cli',
    'node',
    'dist/index.js',
    ...envFlags,
    '--format',
    'json',
    ...args
  ];
  return new Promise((resolve) => {
    execFile('npx', argv, { timeout: 60_000 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({
        code,
        json: parseJson(stdout),
        // On failure the Inspector writes a single JSON line to stderr
        error: parseJson(stderr.trim().split('\n').pop() ?? '')?.error,
        stderr
      });
    });
  });
}

/** @param {string} text */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * @param {boolean} cond
 * @param {string} message
 */
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** @param {{ code: number, error: any, stderr: string }} res */
function assertOk(res) {
  assert(
    res.code === 0,
    `exit ${res.code}: ${JSON.stringify(res.error) ?? res.stderr}`
  );
}

/** @param {any} result */
function firstText(result) {
  return result?.content?.[0]?.text ?? '';
}

/** @type {[string, () => Promise<void>][]} */
const checks = [
  [
    'initialize: server version matches package.json and manifest.json',
    async () => {
      const res = await inspect(['--method', 'initialize']);
      assertOk(res);
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
      const { serverInfo, instructions } = res.json.result;
      assert(
        serverInfo.name === 'Runbook',
        `serverInfo.name is ${serverInfo.name}`
      );
      assert(
        serverInfo.version === pkg.version,
        `serverInfo.version ${serverInfo.version} != package.json ${pkg.version}`
      );
      assert(
        manifest.version === pkg.version,
        `manifest.json ${manifest.version} != package.json ${pkg.version}`
      );
      assert(
        instructions.includes(BASE_URL),
        'instructions do not mention the tenant URL'
      );
    }
  ],
  [
    'tools/list: exposes exactly the expected tools',
    async () => {
      const res = await inspect(['--method', 'tools/list']);
      assertOk(res);
      const tools = res.json.result.tools;
      const names = tools.map((/** @type {any} */ t) => t.name).sort();
      const expected = EXPECTED_TOOLS.map((n) => `runbook-${n}`).sort();
      assert(
        JSON.stringify(names) === JSON.stringify(expected),
        `tools: ${names.join(', ')}`
      );
      for (const tool of tools) {
        assert(!!tool.description, `${tool.name} has no description`);
        assert(
          tool.inputSchema?.type === 'object',
          `${tool.name} inputSchema is not an object`
        );
        assert(
          !!tool.annotations?.title,
          `${tool.name} has no annotations.title`
        );
      }
    }
  ],
  [
    'tools/list --strict: tool schemas are portable',
    async () => {
      const res = await inspect(['--method', 'tools/list', '--strict']);
      assertOk(res);
    }
  ],
  [
    'tools/list: RUNBOOK_PREFIX renames tools',
    async () => {
      const res = await inspect(['--method', 'tools/list'], {
        RUNBOOK_PREFIX: 'smoke'
      });
      assertOk(res);
      const names = res.json.result.tools.map((/** @type {any} */ t) => t.name);
      assert(names.includes('smoke-get-process'), `tools: ${names.join(', ')}`);
      assert(
        names.every((/** @type {string} */ n) => n.startsWith('smoke-')),
        'some tool lacks the prefix'
      );
    }
  ],
  [
    'prompts/list: exposes runbook-init',
    async () => {
      const res = await inspect(['--method', 'prompts/list']);
      assertOk(res);
      const names = res.json.result.prompts.map(
        (/** @type {any} */ p) => p.name
      );
      assert(names.includes('runbook-init'), `prompts: ${names.join(', ')}`);
    }
  ],
  [
    'resources/templates/list: exposes the article template',
    async () => {
      const res = await inspect(['--method', 'resources/templates/list']);
      assertOk(res);
      const uris = res.json.result.resourceTemplates.map(
        (/** @type {any} */ t) => t.uriTemplate
      );
      assert(
        uris.includes('runbook://articles/{articleUid}'),
        `templates: ${uris.join(', ')}`
      );
    }
  ],
  [
    'get-article: rejects an invalid URL without calling the API',
    async () => {
      const res = await inspect([
        '--method',
        'tools/call',
        '--tool-name',
        'runbook-get-article',
        '--tool-arg',
        'articleUid=https://example.runbook.jp/invalid'
      ]);
      assertOk(res);
      assert(
        firstText(res.json.result).startsWith('Error: Invalid URL format'),
        firstText(res.json.result)
      );
    }
  ],
  [
    'get-process: rejects a non-process URL without calling the API',
    async () => {
      const res = await inspect([
        '--method',
        'tools/call',
        '--tool-name',
        'runbook-get-process',
        '--tool-arg',
        'bookUid=https://example.runbook.jp/docs/onboarding/1'
      ]);
      assertOk(res);
      assert(
        firstText(res.json.result).startsWith('Error: Invalid URL format'),
        firstText(res.json.result)
      );
    }
  ],
  [
    'tools/call: an unreachable API is returned as isError',
    async () => {
      const res = await inspect([
        '--method',
        'tools/call',
        '--tool-name',
        'runbook-get-article',
        '--tool-arg',
        'articleUid=ar_smoke'
      ]);
      assert(res.code === 5, `exit ${res.code}, expected 5`);
      assert(
        res.error?.code === 'tool_is_error',
        `error: ${JSON.stringify(res.error)}`
      );
    }
  ],
  [
    'tools/call: an unknown tool is reported as not found',
    async () => {
      const res = await inspect([
        '--method',
        'tools/call',
        '--tool-name',
        'runbook-no-such-tool'
      ]);
      assert(res.code === 5, `exit ${res.code}, expected 5`);
      assert(
        res.error?.code === 'tool_not_found',
        `error: ${JSON.stringify(res.error)}`
      );
    }
  ]
];

async function main() {
  if (!fs.existsSync('dist/index.js')) {
    console.error('dist/index.js not found. Run `pnpm build` first.');
    process.exit(1);
  }

  const results = await Promise.all(
    checks.map(async ([name, check]) => {
      try {
        await check();
        return { name, error: null };
      } catch (e) {
        return { name, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  for (const { name, error } of results) {
    console.log(`${error ? '✗' : '✓'} ${name}`);
    if (error) console.log(`    ${error}`);
  }
  const failed = results.filter((r) => r.error).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();

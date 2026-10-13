// Shared harness for the MCP protocol tests. It links a real SDK Client to a
// server built by buildServer() in-process, so assertions are on what crosses
// the wire: the tool list, call results and errors. connect() speaks either
// protocol era: 'legacy' (2025-11-25, initialize handshake) or 'modern'
// (2026-07-28, server/discover).
//
// Only the Runbook API client is mocked. Each test file must declare:
//
//   jest.mock('@runbook-docs/client', () => ({
//     __esModule: true,
//     ...jest.requireActual('@runbook-docs/client'),
//     default: jest.fn()
//   }));
//
// and then call mockRunbook() to get the mocked API methods.

import Runbook from '@runbook-docs/client';
import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport
} from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '../server';
import { McpState } from '../state';

export const defaultState: McpState = {
  name: 'runbook',
  baseUrl: 'https://test.runbook.jp',
  accessToken: 'test-token'
};

export interface RunbookMock {
  graphql: jest.Mock;
  query: jest.Mock;
  api: jest.Mock;
}

/** Make every `new Runbook()` return the same set of mocked API methods. */
export function mockRunbook(): RunbookMock {
  const mock: RunbookMock = {
    graphql: jest.fn(),
    query: jest.fn(),
    api: jest.fn()
  };
  (Runbook as unknown as jest.Mock).mockImplementation(() => mock);
  return mock;
}

type GraphqlResponse = unknown | ((variables: any) => unknown);

/**
 * Answer runbook.graphql() by the query string it is called with, so tests
 * don't depend on call order. Unlisted queries throw.
 */
export function respondToGraphql(
  runbook: RunbookMock,
  responses: Record<string, GraphqlResponse>
) {
  runbook.graphql.mockImplementation(
    async ({ query, variables }: { query: string; variables: any }) => {
      if (!(query in responses)) {
        throw new Error(`Unexpected query: ${query.trim().slice(0, 80)}`);
      }
      const response = responses[query];
      return typeof response === 'function' ? response(variables) : response;
    }
  );
}

/** Variables of every runbook.graphql() call made with `query`. */
export function variablesOf(runbook: RunbookMock, query: string) {
  return runbook.graphql.mock.calls
    .filter(([arg]) => arg.query === query)
    .map(([arg]) => arg.variables);
}

export interface Connected {
  client: Client;
  close: () => Promise<void>;
}

export type Era = 'legacy' | 'modern';

export const ERAS: Era[] = ['legacy', 'modern'];

/** Build a server for `state` and connect a Client to it in-process. */
export async function connect(
  state: McpState = defaultState,
  era: Era = 'legacy'
): Promise<Connected> {
  return era === 'modern' ? connectModern(state) : connectLegacy(state);
}

async function connectLegacy(state: McpState): Promise<Connected> {
  const server = await buildServer(state);
  const client = new Client({ name: 'runbook-test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

// InMemoryTransport only speaks the 2025 era, so the modern era goes through
// createMcpHandler's fetch function. The URL is never dialed.
async function connectModern(state: McpState): Promise<Connected> {
  const handler = createMcpHandler(() => buildServer(state));
  const client = new Client(
    { name: 'runbook-test-client', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } }
  );
  const transport = new StreamableHTTPClientTransport(
    new URL('http://runbook.test/mcp'),
    { fetch: (url, init) => handler.fetch(new Request(url, init)) }
  );
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close();
    }
  };
}

export interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

/** Call a tool and return its result in wire shape. */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

/** Parse the JSON text of the first content item. */
export function parseText(result: ToolResult): any {
  return JSON.parse(result.content[0].text);
}

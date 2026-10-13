// Shared harness for the MCP protocol tests. It links a real SDK Client to a
// server built by buildServer() over an in-memory transport, so assertions are
// on what crosses the wire: the tool list, call results and errors.
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
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
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

/** Build a server for `state` and connect a Client to it in-process. */
export async function connect(
  state: McpState = defaultState
): Promise<Connected> {
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

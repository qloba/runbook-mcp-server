import { ProtocolErrorCode } from '@modelcontextprotocol/client';
import { RequestError } from '@runbook-docs/client';
import getArticleQuery from '../queries/getArticle';
import getBookQuery from '../queries/getBook';
import {
  callTool,
  connect,
  Connected,
  defaultState,
  mockRunbook,
  respondToGraphql,
  RunbookMock
} from './helpers';

jest.mock('@runbook-docs/client', () => ({
  __esModule: true,
  ...jest.requireActual('@runbook-docs/client'),
  default: jest.fn()
}));

let runbook: RunbookMock;
let conn: Connected;

beforeEach(async () => {
  runbook = mockRunbook();
  conn = await connect();
});

afterEach(async () => {
  await conn.close();
});

describe('initialize', () => {
  it('names the server after the prefix and mentions the tenant', async () => {
    await conn.close();
    conn = await connect({ ...defaultState, name: 'my-runbook' });

    expect(conn.client.getServerVersion()?.name).toBe('MyRunbook');
    expect(conn.client.getInstructions()).toContain('https://test.runbook.jp');
  });
});

describe('tools/list', () => {
  it('prefixes every tool name with the server name', async () => {
    await conn.close();
    conn = await connect({ ...defaultState, name: 'other' });

    const { tools } = await conn.client.listTools();

    expect(tools).toHaveLength(12);
    expect(tools.every((t) => t.name.startsWith('other-'))).toBe(true);
    // Cross references in descriptions follow the prefix too
    const search = tools.find((t) => t.name === 'other-search-articles');
    expect(search?.description).toContain('`other-get-article`');
  });

  it('marks only write tools as non read-only', async () => {
    const { tools } = await conn.client.listTools();
    const writable = tools
      .filter((t) => !t.annotations?.readOnlyHint)
      .map((t) => t.name)
      .sort();

    expect(writable).toEqual([
      'runbook-create-article',
      'runbook-run-process',
      'runbook-update-article',
      'runbook-upload-run-state-file'
    ]);
  });
});

describe('tools/call errors', () => {
  it('rejects an unknown tool', async () => {
    await expect(
      callTool(conn.client, 'runbook-no-such-tool', {})
    ).rejects.toThrow(/Unknown tool: runbook-no-such-tool/);
  });

  it('returns RequestError attributes as JSON', async () => {
    runbook.graphql.mockRejectedValue(new RequestError('denied', 403));

    const result = await callTool(conn.client, 'runbook-get-article', {
      articleUid: 'ar_1'
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      base: [{ message: 'Forbidden.', error: 'forbidden' }]
    });
  });

  it('returns other errors as their message', async () => {
    runbook.query.mockRejectedValue(new Error('timeout'));

    const result = await callTool(conn.client, 'runbook-list-books', {});

    expect(result).toEqual({
      content: [{ type: 'text', text: 'timeout' }],
      isError: true
    });
  });
});

describe('resources', () => {
  it('lists books as resources', async () => {
    runbook.query.mockResolvedValue({
      organization: {
        books: {
          nodes: [
            { uid: 'bk_1', name: 'Manual', description: 'How we work' },
            { uid: 'bk_2', name: 'Notes', description: null }
          ]
        }
      }
    });

    const { resources } = await conn.client.listResources();

    expect(runbook.query).toHaveBeenCalledWith('getBooks', { first: 100 });
    expect(resources).toEqual([
      {
        uri: 'runbook://books/bk_1',
        name: 'Manual',
        description: 'How we work',
        mimeType: 'application/json'
      },
      {
        uri: 'runbook://books/bk_2',
        name: 'Notes',
        description: 'Book: Notes',
        mimeType: 'application/json'
      }
    ]);
  });

  it('lists the article template', async () => {
    const { resourceTemplates } = await conn.client.listResourceTemplates();

    expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual([
      'runbook://articles/{articleUid}'
    ]);
  });

  it('reads a book', async () => {
    respondToGraphql(runbook, {
      [getBookQuery]: { node: { uid: 'bk_1', name: 'Manual' } }
    });

    const { contents } = await conn.client.readResource({
      uri: 'runbook://books/bk_1'
    });

    expect(contents[0].uri).toBe('runbook://books/bk_1');
    expect(contents[0].mimeType).toBe('application/json');
    expect(JSON.parse((contents[0] as { text: string }).text)).toEqual({
      application: 'Runbook',
      type: 'Book',
      uid: 'bk_1',
      name: 'Manual',
      url: 'https://test.runbook.jp/books/bk_1'
    });
  });

  it('reads an article', async () => {
    respondToGraphql(runbook, {
      [getArticleQuery]: { node: { uid: 'ar_1', name: 'Intro' } }
    });

    const { contents } = await conn.client.readResource({
      uri: 'runbook://articles/ar_1'
    });

    expect(JSON.parse((contents[0] as { text: string }).text)).toEqual({
      application: 'Runbook',
      type: 'Article',
      uid: 'ar_1',
      name: 'Intro',
      url: 'https://test.runbook.jp/articles/ar_1'
    });
  });

  it('rejects an unknown URI as invalid params', async () => {
    await expect(
      conn.client.readResource({ uri: 'runbook://folders/fo_1' })
    ).rejects.toMatchObject({
      code: ProtocolErrorCode.InvalidParams,
      message: expect.stringContaining('Invalid URI: runbook://folders/fo_1')
    });
  });

  // Per the 2026-07-28 spec, a missing resource is -32602 with the URI in
  // data, not the legacy -32002
  it('rejects a missing book as invalid params with the URI', async () => {
    respondToGraphql(runbook, { [getBookQuery]: { node: null } });

    await expect(
      conn.client.readResource({ uri: 'runbook://books/bk_none' })
    ).rejects.toMatchObject({
      code: ProtocolErrorCode.InvalidParams,
      message: expect.stringContaining('Book not found: bk_none'),
      data: { uri: 'runbook://books/bk_none' }
    });
  });

  it('rejects API failures when listing resources', async () => {
    runbook.query.mockRejectedValue(new Error('timeout'));

    await expect(conn.client.listResources()).rejects.toThrow(/timeout/);
  });
});

describe('prompts', () => {
  it('lists the init prompt', async () => {
    const { prompts } = await conn.client.listPrompts();

    expect(prompts).toEqual([
      {
        name: 'runbook-init',
        title: 'Runbook Skill Bootstrap',
        description:
          'Bootstrap a Runbook skill file with the current environment snapshot',
        arguments: []
      }
    ]);
  });

  it('returns the prompt as a user message with prefixed tool names', async () => {
    const { messages } = await conn.client.getPrompt({ name: 'runbook-init' });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    const text = (messages[0].content as { text: string }).text;
    expect(text).toMatch(/^# runbook-init prompt/);
    expect(text).toContain('`runbook-list-books`');
  });

  it('rejects an unknown prompt', async () => {
    await expect(
      conn.client.getPrompt({ name: 'runbook-nope' })
    ).rejects.toThrow(/Unknown prompt: runbook-nope/);
  });
});

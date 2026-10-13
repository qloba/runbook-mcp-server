import getBookQuery from '../queries/getBook';
import getBookByPathQuery from '../queries/getBookByPath';
import getRunStateQuery from '../queries/getRunState';
import getArticleWithPropertiesQuery from '../queries/getArticleWithProperties';
import {
  callTool,
  connect,
  Connected,
  defaultState,
  Era,
  ERAS,
  mockRunbook,
  parseText,
  respondToGraphql,
  RunbookMock,
  variablesOf
} from './helpers';

jest.mock('@runbook-docs/client', () => ({
  __esModule: true,
  ...jest.requireActual('@runbook-docs/client'),
  default: jest.fn()
}));

const TOOL = 'runbook-get-process';

const book = {
  uid: 'bk_flow',
  name: 'Onboarding',
  pathname: 'onboarding',
  bookType: 'workflow',
  workspace: { uid: 'ws_1', name: 'HR' },
  initialArticle: { uid: 'ar_initial' }
};

const runState = {
  uid: 'rs_1',
  status: 'running',
  processedArticles: [{ uid: 'ar_initial' }],
  book,
  assignedArticle: null as { uid: string; processed: boolean } | null,
  currentArticle: { uid: 'ar_current' } as { uid: string } | null
};

function article(uid: string) {
  return {
    uid,
    name: `Article ${uid}`,
    bodyMarkdown: `body of ${uid}`,
    properties: [{ uid: 'pr_1', name: 'Name' }]
  };
}

function respondWith(runbook: RunbookMock, responses: Record<string, unknown>) {
  respondToGraphql(runbook, {
    [getArticleWithPropertiesQuery]: (variables: any) => ({
      node: article(variables.articleUid)
    }),
    ...responses
  });
}

describe.each(ERAS)('%s era', (era: Era) => {
  describe('get-process', () => {
    let runbook: RunbookMock;
    let conn: Connected;

    beforeEach(async () => {
      runbook = mockRunbook();
      conn = await connect(defaultState, era);
    });

    afterEach(async () => {
      await conn.close();
    });

    it('is listed with read-only annotations', async () => {
      const { tools } = await conn.client.listTools();
      const tool = tools.find((t) => t.name === TOOL);
      expect(tool?.inputSchema.required).toEqual(['bookUid']);
      expect(tool?.annotations?.readOnlyHint).toBe(true);
    });

    describe('with a book UID', () => {
      it('returns the initial article of the workflow', async () => {
        respondWith(runbook, { [getBookQuery]: { node: book } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow'
        });

        expect(variablesOf(runbook, getBookQuery)).toEqual([
          { bookUid: 'bk_flow' }
        ]);
        expect(parseText(result)).toEqual({
          uid: 'bk_flow',
          name: 'Onboarding',
          workspace: { uid: 'ws_1', name: 'HR' },
          runState: null,
          currentArticle: article('ar_initial')
        });
      });

      it('rejects a book that is not a workflow', async () => {
        respondWith(runbook, {
          [getBookQuery]: { node: { ...book, bookType: 'docs' } }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow'
        });

        expect(result.content[0].text).toBe(
          'Error: Book with UID bk_flow is not a workflow.'
        );
        expect(variablesOf(runbook, getArticleWithPropertiesQuery)).toEqual([]);
      });

      it('rejects a missing book', async () => {
        respondWith(runbook, { [getBookQuery]: { node: null } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_none'
        });

        expect(result.content[0].text).toBe(
          'Error: Book with UID bk_none is not a workflow.'
        );
      });
    });

    describe('with a run state', () => {
      it('returns the current article and run state', async () => {
        respondWith(runbook, { [getRunStateQuery]: { node: runState } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          runStateUid: 'rs_1'
        });

        expect(variablesOf(runbook, getRunStateQuery)).toEqual([
          { runStateUid: 'rs_1' }
        ]);
        expect(variablesOf(runbook, getBookQuery)).toEqual([]);
        const body = parseText(result);
        expect(body.runState).toEqual({
          uid: 'rs_1',
          status: 'running',
          processedArticles: [{ uid: 'ar_initial' }]
        });
        expect(body.currentArticle.uid).toBe('ar_current');
      });

      it('prefers an unprocessed assigned article', async () => {
        respondWith(runbook, {
          [getRunStateQuery]: {
            node: {
              ...runState,
              assignedArticle: { uid: 'ar_assigned', processed: false }
            }
          }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          runStateUid: 'rs_1'
        });

        expect(parseText(result).currentArticle.uid).toBe('ar_assigned');
      });

      it('falls back to the current article when the assignment is processed', async () => {
        respondWith(runbook, {
          [getRunStateQuery]: {
            node: {
              ...runState,
              assignedArticle: { uid: 'ar_assigned', processed: true }
            }
          }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          runStateUid: 'rs_1'
        });

        expect(parseText(result).currentArticle.uid).toBe('ar_current');
      });

      it('reports a completed run state', async () => {
        respondWith(runbook, {
          [getRunStateQuery]: { node: { ...runState, currentArticle: null } }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          runStateUid: 'rs_1'
        });

        expect(result.content[0].text).toBe(
          'Run state with UID rs_1 may have been completed. No current article found.'
        );
      });

      it('rejects a run state of another book', async () => {
        respondWith(runbook, { [getRunStateQuery]: { node: runState } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_other',
          runStateUid: 'rs_1'
        });

        expect(result.content[0].text).toBe(
          'Error: Run state with UID rs_1 does not belong to the book specified by bk_other.'
        );
      });
    });

    describe('with a URL', () => {
      it('looks up the book by pathname', async () => {
        respondWith(runbook, { [getBookByPathQuery]: { book } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'https://test.runbook.jp/procs/onboarding/12'
        });

        expect(variablesOf(runbook, getBookByPathQuery)).toEqual([
          { pathname: 'onboarding' }
        ]);
        expect(parseText(result).currentArticle.uid).toBe('ar_initial');
      });

      it('uses the run_state query parameter', async () => {
        respondWith(runbook, { [getRunStateQuery]: { node: runState } });

        const result = await callTool(conn.client, TOOL, {
          bookUid:
            'https://test.runbook.jp/procs/onboarding?foo=1&run_state=rs_1'
        });

        expect(variablesOf(runbook, getRunStateQuery)).toEqual([
          { runStateUid: 'rs_1' }
        ]);
        expect(variablesOf(runbook, getBookByPathQuery)).toEqual([]);
        expect(parseText(result).runState.uid).toBe('rs_1');
      });

      it('prefers runStateUid over the run_state query parameter', async () => {
        respondWith(runbook, {
          [getRunStateQuery]: { node: { ...runState, uid: 'rs_2' } }
        });

        await callTool(conn.client, TOOL, {
          bookUid: 'https://test.runbook.jp/procs/onboarding?run_state=rs_1',
          runStateUid: 'rs_2'
        });

        expect(variablesOf(runbook, getRunStateQuery)).toEqual([
          { runStateUid: 'rs_2' }
        ]);
      });

      it('rejects a run state whose book pathname differs', async () => {
        respondWith(runbook, { [getRunStateQuery]: { node: runState } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'https://test.runbook.jp/procs/other?run_state=rs_1'
        });

        expect(result.content[0].text).toMatch(/does not belong to the book/);
      });

      it('rejects a URL that is not a process URL', async () => {
        respondWith(runbook, {});

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'https://test.runbook.jp/docs/onboarding/1'
        });

        expect(result.content[0].text).toMatch(/^Error: Invalid URL format/);
        expect(runbook.graphql).not.toHaveBeenCalled();
      });
    });

    it('returns API failures as isError', async () => {
      runbook.graphql.mockRejectedValue(new Error('network down'));

      const result = await callTool(conn.client, TOOL, { bookUid: 'bk_flow' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('network down');
    });
  });
});

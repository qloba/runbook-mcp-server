import getBookQuery from '../queries/getBook';
import runProcessQuery from '../queries/runProcess';
import updateRunStateQuery from '../queries/updateRunState';
import finishProcessQuery from '../queries/finishProcess';
import getAssignedRunStatesQuery from '../queries/getAssignedRunStates';
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

const TOOL = 'runbook-run-process';

const book = {
  uid: 'bk_flow',
  bookType: 'workflow',
  initialArticle: { uid: 'ar_initial' }
};

const nextArticle = {
  uid: 'ar_next',
  name: 'Step 2',
  bodyMarkdown: 'step 2',
  properties: [{ uid: 'pr_1' }],
  hasAssignees: false,
  isAssigned: false
};

const runningState = { uid: 'rs_1', status: 'running', readyToFinish: false };

describe.each(ERAS)('%s era', (era: Era) => {
  let runbook: RunbookMock;
  let conn: Connected;

  beforeEach(async () => {
    runbook = mockRunbook();
    conn = await connect(defaultState, era);
  });

  afterEach(async () => {
    await conn.close();
  });

  describe('run-process', () => {
    describe('starting a new process', () => {
      it('runs the book with converted property values', async () => {
        respondToGraphql(runbook, {
          [getBookQuery]: { node: book },
          [runProcessQuery]: {
            runProcess: { nextArticle, runState: runningState }
          }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          articleUid: 'ar_initial',
          propertyValues: { 'pr:text': 'hello', 'pr:check': ['SNS', 'YouTube'] }
        });

        expect(variablesOf(runbook, runProcessQuery)).toEqual([
          {
            bookUid: 'bk_flow',
            propertyValues: [
              { propId: 'pr:text', value: 'hello' },
              { propId: 'pr:check', value: '["SNS","YouTube"]' }
            ]
          }
        ]);
        expect(parseText(result)).toEqual({
          runState: { uid: 'rs_1', status: 'running' },
          nextArticle: {
            uid: 'ar_next',
            name: 'Step 2',
            bodyMarkdown: 'step 2',
            properties: [{ uid: 'pr_1' }]
          },
          message: null
        });
      });

      it('sends empty property values when none are given', async () => {
        respondToGraphql(runbook, {
          [getBookQuery]: { node: book },
          [runProcessQuery]: {
            runProcess: { nextArticle, runState: runningState }
          }
        });

        await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          articleUid: 'ar_initial'
        });

        expect(variablesOf(runbook, runProcessQuery)[0].propertyValues).toEqual(
          []
        );
      });

      it('rejects an article other than the initial one', async () => {
        respondToGraphql(runbook, { [getBookQuery]: { node: book } });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          articleUid: 'ar_other'
        });

        expect(result.content[0].text).toMatch(
          /^Error: Invalid article UID\. .*bk_flow using `runbook-get-process`/
        );
        expect(variablesOf(runbook, runProcessQuery)).toEqual([]);
      });
    });

    describe('continuing a process', () => {
      it('updates the run state with the article and values', async () => {
        respondToGraphql(runbook, {
          [getBookQuery]: { node: book },
          [updateRunStateQuery]: {
            updateRunState: {
              nextArticle,
              runState: runningState,
              isAssignee: false
            }
          }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          articleUid: 'ar_current',
          runStateUid: 'rs_1',
          propertyValues: { 'pr:text': 'v' }
        });

        expect(variablesOf(runbook, updateRunStateQuery)).toEqual([
          {
            uid: 'rs_1',
            articleUid: 'ar_current',
            propertyValues: [{ propId: 'pr:text', value: 'v' }]
          }
        ]);
        expect(variablesOf(runbook, runProcessQuery)).toEqual([]);
        expect(parseText(result).nextArticle.uid).toBe('ar_next');
      });

      it('reports completion of an assigned step', async () => {
        respondToGraphql(runbook, {
          [getBookQuery]: { node: book },
          [updateRunStateQuery]: {
            updateRunState: {
              nextArticle,
              runState: runningState,
              isAssignee: true
            }
          }
        });

        const result = await callTool(conn.client, TOOL, {
          bookUid: 'bk_flow',
          articleUid: 'ar_current',
          runStateUid: 'rs_1'
        });

        expect(result.content[0].text).toBe(
          'The assigned process has been completed.'
        );
      });
    });

    it('hides the next article when it is assigned to someone else', async () => {
      respondToGraphql(runbook, {
        [getBookQuery]: { node: book },
        [runProcessQuery]: {
          runProcess: {
            nextArticle: {
              ...nextArticle,
              hasAssignees: true,
              isAssigned: false
            },
            runState: runningState
          }
        }
      });

      const result = await callTool(conn.client, TOOL, {
        bookUid: 'bk_flow',
        articleUid: 'ar_initial'
      });

      const body = parseText(result);
      expect(body.nextArticle).toBeNull();
      expect(body.message).toMatch(/you are not assigned to it/);
    });

    it('keeps the next article when the user is an assignee', async () => {
      respondToGraphql(runbook, {
        [getBookQuery]: { node: book },
        [runProcessQuery]: {
          runProcess: {
            nextArticle: {
              ...nextArticle,
              hasAssignees: true,
              isAssigned: true
            },
            runState: runningState
          }
        }
      });

      const result = await callTool(conn.client, TOOL, {
        bookUid: 'bk_flow',
        articleUid: 'ar_initial'
      });

      expect(parseText(result).nextArticle.uid).toBe('ar_next');
    });

    it('finishes the process when the run state is ready to finish', async () => {
      respondToGraphql(runbook, {
        [getBookQuery]: { node: book },
        [updateRunStateQuery]: {
          updateRunState: {
            nextArticle,
            runState: { ...runningState, readyToFinish: true },
            isAssignee: false
          }
        },
        [finishProcessQuery]: {
          finishProcess: {
            runState: { uid: 'rs_1', status: 'completed' },
            finishMessage: 'All done'
          }
        }
      });

      const result = await callTool(conn.client, TOOL, {
        bookUid: 'bk_flow',
        articleUid: 'ar_last',
        runStateUid: 'rs_1'
      });

      expect(variablesOf(runbook, finishProcessQuery)).toEqual([
        { uid: 'rs_1' }
      ]);
      expect(parseText(result)).toEqual({
        runState: { uid: 'rs_1', status: 'completed' },
        nextArticle: null,
        message: 'All done'
      });
    });

    it.each([
      ['a missing book', null],
      ['a non-workflow book', { ...book, bookType: 'docs' }]
    ])('rejects %s', async (_, node) => {
      respondToGraphql(runbook, { [getBookQuery]: { node } });

      const result = await callTool(conn.client, TOOL, {
        bookUid: 'bk_flow',
        articleUid: 'ar_initial'
      });

      expect(result.content[0].text).toBe(
        'Error: Book with UID bk_flow is not a workflow.'
      );
    });
  });

  describe('list-assigned-processes', () => {
    it('queries in-progress unprocessed run states and trims the fields', async () => {
      respondToGraphql(runbook, {
        [getAssignedRunStatesQuery]: {
          loginUser: {
            assignedRunStates: {
              nodes: [
                {
                  uid: 'rs_1',
                  status: 'in_progress',
                  createdAt: '2026-10-01T00:00:00Z',
                  user: { uid: 'us_1', name: 'Alice', email: 'a@example.com' },
                  book: { uid: 'bk_flow', name: 'Onboarding', extra: true },
                  extra: true
                }
              ]
            }
          }
        }
      });

      const result = await callTool(
        conn.client,
        'runbook-list-assigned-processes',
        {}
      );

      expect(variablesOf(runbook, getAssignedRunStatesQuery)).toEqual([
        { status: 'in_progress', processed: false }
      ]);
      expect(parseText(result)).toEqual([
        {
          uid: 'rs_1',
          status: 'in_progress',
          createdAt: '2026-10-01T00:00:00Z',
          user: { uid: 'us_1', name: 'Alice' },
          book: { uid: 'bk_flow', name: 'Onboarding' }
        }
      ]);
    });
  });

  describe('upload-run-state-file', () => {
    const presigned = { uid: 'fi_1', upload_url: 'https://s3.example/put' };

    it('requests a presigned URL with the content type', async () => {
      runbook.api.mockResolvedValue(presigned);

      const result = await callTool(
        conn.client,
        'runbook-upload-run-state-file',
        {
          filename: 'doc.pdf',
          content_type: 'application/pdf'
        }
      );

      expect(runbook.api).toHaveBeenCalledWith({
        path: 'run_state_attachment_files/presigned_url',
        method: 'POST',
        data: { filename: 'doc.pdf', content_type: 'application/pdf' }
      });
      expect(parseText(result)).toEqual(presigned);
    });

    it('omits content_type when not given', async () => {
      runbook.api.mockResolvedValue(presigned);

      await callTool(conn.client, 'runbook-upload-run-state-file', {
        filename: 'doc.pdf'
      });

      expect(runbook.api).toHaveBeenCalledWith(
        expect.objectContaining({ data: { filename: 'doc.pdf' } })
      );
    });
  });
});

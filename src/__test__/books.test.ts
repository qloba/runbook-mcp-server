import getBookQuery from '../queries/getBook';
import getFolderQuery from '../queries/getFolder';
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

  describe('list-books', () => {
    it('filters by name and returns the book nodes', async () => {
      const nodes = [{ uid: 'bk_1', name: 'Manual' }];
      runbook.query.mockResolvedValue({ organization: { books: { nodes } } });

      const result = await callTool(conn.client, 'runbook-list-books', {
        bookName: 'Man'
      });

      expect(runbook.query).toHaveBeenCalledWith('getBooks', {
        q: 'Man',
        first: 100
      });
      expect(parseText(result)).toEqual(nodes);
    });
  });

  describe('list-categories', () => {
    it('returns the categories of the book', async () => {
      const nodes = [{ uid: 'ca_1', name: 'FAQ' }];
      runbook.query.mockResolvedValue({ node: { categories: { nodes } } });

      const result = await callTool(conn.client, 'runbook-list-categories', {
        bookUid: 'bk_1'
      });

      expect(runbook.query).toHaveBeenCalledWith('getCategories', {
        bookUid: 'bk_1',
        first: 100
      });
      expect(parseText(result)).toEqual(nodes);
    });
  });

  describe('get-folder', () => {
    const folder = {
      uid: 'fo_1',
      name: 'Guides',
      ancestors: [],
      children: [{ uid: 'ar_1', name: 'Intro' }]
    };

    it('uses the root folder of the book when folderUid is omitted', async () => {
      respondToGraphql(runbook, {
        [getBookQuery]: {
          node: { uid: 'bk_1', rootFolder: { uid: 'fo_root' } }
        },
        [getFolderQuery]: { node: folder }
      });

      const result = await callTool(conn.client, 'runbook-get-folder', {
        bookUid: 'bk_1'
      });

      expect(variablesOf(runbook, getBookQuery)).toEqual([{ bookUid: 'bk_1' }]);
      expect(variablesOf(runbook, getFolderQuery)).toEqual([
        { folderUid: 'fo_root' }
      ]);
      expect(parseText(result)).toEqual(folder);
    });

    it('fetches the given folder without looking up the book', async () => {
      respondToGraphql(runbook, { [getFolderQuery]: { node: folder } });

      await callTool(conn.client, 'runbook-get-folder', {
        bookUid: 'bk_1',
        folderUid: 'fo_1'
      });

      expect(variablesOf(runbook, getBookQuery)).toEqual([]);
      expect(variablesOf(runbook, getFolderQuery)).toEqual([
        { folderUid: 'fo_1' }
      ]);
    });

    it('reports a missing book', async () => {
      respondToGraphql(runbook, { [getBookQuery]: { node: null } });

      const result = await callTool(conn.client, 'runbook-get-folder', {
        bookUid: 'bk_none'
      });

      expect(result.content[0].text).toBe('Error: Book not found: bk_none');
    });

    it('reports a missing folder', async () => {
      respondToGraphql(runbook, { [getFolderQuery]: { node: null } });

      const result = await callTool(conn.client, 'runbook-get-folder', {
        bookUid: 'bk_1',
        folderUid: 'fo_none'
      });

      expect(result.content[0].text).toBe('Error: Folder not found: fo_none');
    });
  });
});

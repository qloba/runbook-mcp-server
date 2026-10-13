import getArticleQuery from '../queries/getArticle';
import getArticleByPathQuery from '../queries/getArticleByPath';
import createArticleQuery from '../queries/createArticle';
import updateArticleQuery from '../queries/updateArticle';
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

  describe('search-articles', () => {
    it('passes params through and makes URLs absolute', async () => {
      runbook.query.mockResolvedValue({
        searchResults: {
          nodes: [
            { uid: 'ar_1', name: 'One', url: '/articles/ar_1' },
            { uid: 'ar_2', name: 'Two', url: '/articles/ar_2' }
          ]
        }
      });

      const params = { keywords: 'foo bar', scope: 'bk_1', limit: 5 };
      const result = await callTool(
        conn.client,
        'runbook-search-articles',
        params
      );

      expect(runbook.query).toHaveBeenCalledWith('search', params);
      expect(parseText(result)).toEqual([
        {
          uid: 'ar_1',
          name: 'One',
          url: 'https://test.runbook.jp/articles/ar_1'
        },
        {
          uid: 'ar_2',
          name: 'Two',
          url: 'https://test.runbook.jp/articles/ar_2'
        }
      ]);
    });
  });

  describe('get-article', () => {
    const article = { uid: 'ar_1', name: 'Hello', bodyMarkdown: '# hi' };

    it('fetches by UID', async () => {
      respondToGraphql(runbook, { [getArticleQuery]: { node: article } });

      const result = await callTool(conn.client, 'runbook-get-article', {
        articleUid: 'ar_1'
      });

      expect(variablesOf(runbook, getArticleQuery)).toEqual([
        { articleUid: 'ar_1' }
      ]);
      expect(parseText(result)).toEqual({
        ...article,
        url: 'https://test.runbook.jp/articles/ar_1'
      });
    });

    it('fetches by URL using the pathname and article ID', async () => {
      respondToGraphql(runbook, {
        [getArticleByPathQuery]: { book: { article } }
      });

      const result = await callTool(conn.client, 'runbook-get-article', {
        articleUid: 'https://test.runbook.jp/docs/movies/2/starwars'
      });

      expect(variablesOf(runbook, getArticleByPathQuery)).toEqual([
        { pathname: 'movies', articleId: '2' }
      ]);
      expect(parseText(result).uid).toBe('ar_1');
    });

    it('rejects a URL without an article ID', async () => {
      const result = await callTool(conn.client, 'runbook-get-article', {
        articleUid: 'https://test.runbook.jp/docs/movies'
      });

      expect(result.content[0].text).toMatch(/^Error: Invalid URL format/);
      expect(runbook.graphql).not.toHaveBeenCalled();
    });

    it('reports a missing article by UID', async () => {
      respondToGraphql(runbook, { [getArticleQuery]: { node: null } });

      const result = await callTool(conn.client, 'runbook-get-article', {
        articleUid: 'ar_none'
      });

      expect(result.content[0].text).toBe('Error: Article not found.');
    });

    it('reports a missing article by URL', async () => {
      respondToGraphql(runbook, { [getArticleByPathQuery]: { book: null } });

      const result = await callTool(conn.client, 'runbook-get-article', {
        articleUid: 'https://test.runbook.jp/docs/movies/99'
      });

      expect(result.content[0].text).toBe('Error: Article not found.');
    });
  });

  describe('list-articles', () => {
    it('maps arguments to the getArticles query', async () => {
      const nodes = [{ uid: 'ar_1', name: 'One' }];
      runbook.query.mockResolvedValue({ node: { articles: { nodes } } });

      const result = await callTool(conn.client, 'runbook-list-articles', {
        bookUid: 'bk_1',
        articleName: 'On',
        categoryUid: 'ca_1',
        orderBy: 'name'
      });

      expect(runbook.query).toHaveBeenCalledWith('getArticles', {
        bookUid: 'bk_1',
        q: 'On',
        categoryUid: 'ca_1',
        orderBy: 'name',
        first: 100
      });
      expect(parseText(result)).toEqual(nodes);
    });
  });

  describe('create-article', () => {
    it('creates the article and returns its UID and URL', async () => {
      respondToGraphql(runbook, {
        [createArticleQuery]: { createArticle: { article: { uid: 'ar_new' } } }
      });

      const result = await callTool(conn.client, 'runbook-create-article', {
        bookUid: 'bk_1',
        name: 'New',
        bodyMarkdown: '## body',
        categoryUids: ['ca_1', 'ca_2']
      });

      expect(variablesOf(runbook, createArticleQuery)).toEqual([
        {
          bookUid: 'bk_1',
          name: 'New',
          bodyMarkdown: '## body',
          categoryUids: ['ca_1', 'ca_2']
        }
      ]);
      expect(parseText(result)).toEqual({
        uid: 'ar_new',
        url: 'https://test.runbook.jp/articles/ar_new'
      });
    });
  });

  describe('update-article', () => {
    it('sends articleUid as uid and leaves omitted fields undefined', async () => {
      respondToGraphql(runbook, {
        [updateArticleQuery]: { updateArticle: { article: { uid: 'ar_1' } } }
      });

      const result = await callTool(conn.client, 'runbook-update-article', {
        articleUid: 'ar_1',
        name: 'Renamed'
      });

      expect(variablesOf(runbook, updateArticleQuery)).toEqual([
        {
          uid: 'ar_1',
          name: 'Renamed',
          bodyMarkdown: undefined,
          categoryUids: undefined
        }
      ]);
      expect(parseText(result)).toEqual({
        uid: 'ar_1',
        url: 'https://test.runbook.jp/articles/ar_1'
      });
    });
  });
});

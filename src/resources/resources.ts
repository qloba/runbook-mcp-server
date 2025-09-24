import { Resource } from '@modelcontextprotocol/sdk/types.js';
import Runbook from '@runbook-docs/client';
import { GetBooksQuery } from '@runbook-docs/client/dist/queries/types';
import { GetArticleQuery, GetBookQuery } from '../types';
import getArticleQuery from '../queries/getArticle';
import getBookQuery from '../queries/getBook';
import { McpState } from '../state';

const RESOURCE_PREFIX = 'runbook://';
const BOOK_REGEX = /^runbook:\/\/books\/(.+)$/;
const ARTICLE_REGEX = /^runbook:\/\/articles\/(.+)$/;

export const resourceHandlers = function (state: McpState) {
  const runbook = new Runbook({
    baseUrl: state.baseUrl,
    apiToken: state.accessToken
  });
  return {
    listResourceTemplates: () => ({
      resourceTemplates: [
        {
          uriTemplate: `${RESOURCE_PREFIX}articles/{articleUid}`,
          name: 'Article',
          description: 'Retrieve an article by its UID',
          mimeType: 'application/json'
        }
      ]
    }),

    listResources: async (): Promise<Resource[]> => {
      const data: GetBooksQuery = await runbook.query('getBooks', {
        first: 100
      });

      const books = data.organization.books.nodes;

      return books.map((book) => ({
        uri: `${RESOURCE_PREFIX}books/${book.uid}`,
        name: book.name,
        description: book.description || `Book: ${book.name}`,
        mimeType: 'application/json'
      }));
    },

    readResource: async (uri: string) => {
      const bookMatch = uri.match(BOOK_REGEX);
      const articleMatch = uri.match(ARTICLE_REGEX);

      if (bookMatch) {
        const bookUid = bookMatch[1];
        const data: GetBookQuery = await runbook.graphql<
          any,
          GetBookQuery,
          { bookUid: string }
        >({
          query: getBookQuery,
          variables: {
            bookUid
          }
        });

        const book = data.node;
        if (!book) {
          throw new Error(`Book not found: ${bookUid}`);
        }

        return JSON.stringify(
          {
            ...book
          },
          null,
          2
        );
      }

      if (articleMatch) {
        const articleUid = articleMatch[1];
        const data: GetArticleQuery = await runbook.graphql<
          any,
          GetArticleQuery,
          { articleUid: string }
        >({
          query: getArticleQuery,
          variables: {
            articleUid
          }
        });

        return JSON.stringify(
          {
            ...data.node,
            url: `${state.baseUrl}/articles/${articleUid}`
          },
          null,
          2
        );
      }

      throw new Error(`Invalid URI: ${uri}`);
    }
  };
};

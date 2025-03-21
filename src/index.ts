#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Runbook from '@runbook-docs/client';
import {
  GetArticleQuery,
  GetArticlesQuery,
  GetBooksQuery
} from '@runbook-docs/client/dist/queries/types';

const server = new McpServer({
  name: 'Runbook',
  version: '1.0.0'
});

const runbook = new Runbook({
  baseUrl: process.env.BASE_URL!,
  apiToken: process.env.API_TOKEN!
});

server.resource(
  'article',
  new ResourceTemplate('runbook://articles/{articleUid}', { list: undefined }),
  {
    description: 'An article data',
    mimeType: 'application/json'
  },
  async (uri, { articleUid }) => {
    const data: GetArticleQuery = await runbook.query('getArticle', {
      articleUid: articleUid.toString()
    });
    return {
      contents: [
        {
          uri: uri.href,
          text: data.node.bodyText,
          mimeType: 'application/json'
        }
      ]
    };
  }
);

server.tool(
  'get-article',
  'Retrieve the article by its ID from the database.',
  {
    articleUid: z
      .string()
      .describe('ID of the article to retrieve. It always starts with `ar_`.')
  },
  async ({ articleUid }) => {
    const data: GetArticleQuery = await runbook.query('getArticle', {
      articleUid
    });
    return {
      content: [
        {
          type: 'text',
          text: data.node.bodyText
        }
      ]
    };
  }
);

server.tool(
  'list-articles',
  `List all articles in a specified book with ID.
The result does not include entire article bodies as they are truncated in 200 characters.
You have to retrieve the full content by calling \`get-article\`.
`,
  {
    bookUid: z
      .string()
      .describe(
        `ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\``
      )
  },
  async ({ bookUid }) => {
    const data: GetArticlesQuery = await runbook.query('getArticles', {
      bookUid,
      first: 50
    });
    const summaries = data.node.articles.nodes.map((article) => {
      return {
        ...article,
        body: article.bodyText.substring(0, 200)
      };
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summaries, null, 2)
        }
      ]
    };
  }
);

server.tool(
  'list-books',
  `Retrieve a list of all books`,
  {
    q: z
      .string()
      .describe(
        `Search query. If provided, the result will be filtered by the query.`
      )
  },
  async ({ q }) => {
    const data: GetBooksQuery = await runbook.query('getBooks', { q: q });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data.organization.books.nodes, null, 2)
        }
      ]
    };
  }
);

async function runServer() {
  console.error('Starting server.');
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});

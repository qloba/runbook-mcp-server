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
  GetBooksQuery,
  GetCategoriesQuery,
  searchQuery
} from '@runbook-docs/client/dist/queries/types';
import getArticleQuery from './queries/getArticle';
import config from './config';

const runbook = new Runbook(config);

function withPrefix(str: string) {
  return config.prefix ? `${config.prefix}-${str}` : str;
}

function serverName() {
  const name = 'Runbook';
  return config.prefix ? `${name}-${config.prefix}` : name;
}

async function buildServer() {
  const server = new McpServer(
    {
      name: serverName(),
      version: '1.0.6'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      },
      instructions:
        config.description ||
        'This MCP server can retrieve documents from Runbook. It can also run workflows.'
    }
  );

  server.resource(
    withPrefix('article'),
    new ResourceTemplate('runbook://articles/{articleUid}', {
      list: undefined
    }),
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
            text: JSON.stringify(
              {
                ...data.node,
                url: `${config.baseUrl}/articles/${articleUid}`
              },
              null,
              2
            ),
            mimeType: 'application/json'
          }
        ]
      };
    }
  );

  server.tool(
    withPrefix('search-articles'),
    `Search for articles using keywords from Runbook.
The result does not include full article bodies as they are truncated to 200 characters.
You will need to retrieve the full content by calling \`get-article\``,
    {
      scope: z
        .string()
        .optional()
        .default('all')
        .describe(
          `ID of the book or workspace. If provided, the result will be filtered by them.`
        ),
      keywords: z
        .string()
        .describe(
          `Space-separated keywords to filter articles. If multiple keywords are provided, the articles that match all of them will be returned. Use current language for keywords`
        ),
      limit: z.number().optional().describe(`Number of articles to retrieve`),
      offset: z.number().optional().describe(`Offset of the search result`),
      orderBy: z
        .enum(['updatedAt', 'createdAt', 'score'])
        .optional()
        .default('score')
        .describe(`Sort the articles by the specified field`)
    },
    async (params) => {
      const data: searchQuery = await runbook.query('search', params);
      const searchResults = data.searchResults.nodes.map((article) => ({
        ...article,
        url: `${config.baseUrl}${article.url}`
      }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(searchResults, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    withPrefix('get-article'),
    'Retrieve the article by its ID from the database.',
    {
      articleUid: z
        .string()
        .describe('ID of the article to retrieve. It always starts with `ar_`.')
    },
    async ({ articleUid }) => {
      const data: GetArticleQuery = await runbook.graphql({
        query: getArticleQuery,
        variables: {
          articleUid
        }
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...data.node,
                url: `${config.baseUrl}/articles/${articleUid}`
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    withPrefix('list-articles'),
    `List top 100 articles in a specified book with ID.
The result does not include full article bodies as they are truncated to 200 characters.
You will need to retrieve the full content by calling \`get-article\`.
`,
    {
      bookUid: z
        .string()
        .describe(
          `ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\``
        ),
      articleName: z
        .string()
        .optional()
        .describe(`If provided, the result will be filtered by article name.`),
      categoryUid: z
        .string()
        .optional()
        .describe(
          `ID of the category. It always starts with 'ca_'. You can retrieve a list of categories with \`list-categories\``
        ),
      orderBy: z
        .enum(['updatedAt', 'createdAt', 'name', 'popularity'])
        .optional()
        .describe(`Sort the articles by the specified field`)
    },
    async (props) => {
      const data: GetArticlesQuery = await runbook.query('getArticles', {
        bookUid: props.bookUid,
        q: props.articleName,
        categoryUid: props.categoryUid,
        orderBy: props.orderBy,
        first: 100
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.node.articles.nodes, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    withPrefix('list-books'),
    `List top 100 books in the organization`,
    {
      bookName: z
        .string()
        .optional()
        .describe(`If provided, the result will be filtered by book name.`)
    },
    async ({ bookName }) => {
      const data: GetBooksQuery = await runbook.query('getBooks', {
        q: bookName,
        first: 100
      });
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

  server.tool(
    withPrefix('list-categories'),
    `List top 100 categories in a specified book with ID`,
    {
      bookUid: z
        .string()
        .describe(
          `ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\``
        )
    },
    async ({ bookUid }) => {
      const data: GetCategoriesQuery = await runbook.query('getCategories', {
        bookUid,
        first: 100
      });
      const categories = data.node.categories.nodes;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(categories, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

export async function runServer() {
  console.error(`Base URL ${config.baseUrl}. Starting server.`);
  const server = await buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

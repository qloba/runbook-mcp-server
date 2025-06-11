#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Runbook from '@runbook-docs/client';
import {
  GetArticlesQuery,
  GetBooksQuery,
  GetCategoriesQuery,
  searchQuery
} from '@runbook-docs/client/dist/queries/types';
import getArticleQuery from './queries/getArticle';
import getBookWithRunStatesQuery from './queries/getBookWithRunStates';
import getBookWithRunStateQuery from './queries/getBookWithRunState';
import getArticleWithPropertiesQuery from './queries/getArticleWithProperties';
import runProcessQuey from './queries/runProcess';
import updateRunStateQuery from './queries/updateRunState';
import {
  RunState,
  GetArticleQuery,
  GetArticleWithPropertiesQuery,
  GetBookWithRunStatesQuery,
  GetBookWithRunStateQuery,
  UpdateRunStateMutation,
  UpdateRunStateMutationVariables,
  ArticleWithProperties,
  RunProcessMutation,
  RunProcessMutationVariables
} from './queries/types';
import config from './config';

const runbook = new Runbook(config);

function withPrefix(str: string) {
  const prefix = config.prefix || 'runbook';
  return `${prefix}-${str}`;
}

function serverName() {
  const name = 'Runbook';
  return config.prefix ? `${name}-${config.prefix}` : name;
}

async function buildServer() {
  const server = new McpServer(
    {
      name: serverName(),
      version: '1.0.7'
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
      const data: GetArticleQuery = await runbook.graphql({
        query: getArticleQuery,
        variables: {
          articleUid
        }
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

  server.tool(
    withPrefix('get-process'),
    `Get current process information by book UID`,
    {
      bookUid: z
        .string()
        .describe(
          `ID of the book. It always starts with 'bk_'. The book type must be 'workflow'.`
        ),
      runStateUid: z
        .string()
        .optional()
        .describe(
          `ID of the run state. It always starts with 'rs_'. If not provided, the first run state will be used.`
        )
    },
    async ({ bookUid, runStateUid }) => {
      let articleUid: string | null = null;
      let runState: RunState | null = null;
      if (runStateUid) {
        const data: GetBookWithRunStateQuery = await runbook.graphql({
          query: getBookWithRunStateQuery,
          variables: {
            bookUid,
            runStateUid
          }
        });
        if (!data || data.node.bookType !== 'workflow') {
          const err = `Book with UID ${bookUid} is not a workflow.`;
          return {
            content: [{ type: 'text', text: `Error: ${err}` }]
          };
        }
        runState = data.node.runState;
        if (runState?.currentArticle?.hasAssignees) {
          const err = `Run state with UID ${runStateUid} has no current article with assignees.`;
          return {
            content: [{ type: 'text', text: `Error: ${err}` }]
          };
        }
        articleUid =
          data.node.runState?.currentArticle?.uid ||
          data.node.initialArticle.uid;
      } else {
        const data: GetBookWithRunStatesQuery = await runbook.graphql({
          query: getBookWithRunStatesQuery,
          variables: {
            bookUid
          }
        });
        if (!data || data.node.bookType !== 'workflow') {
          const err = `Book with UID ${bookUid} is not a workflow.`;
          return {
            content: [{ type: 'text', text: `Error: ${err}` }]
          };
        }

        if (data.node.runStates.nodes.length > 0) {
          runState = data.node.runStates.nodes[0];
          if (runState.currentArticle?.hasAssignees) {
            const err = `Run state with UID ${runStateUid} has no current article with assignees.`;
            return {
              content: [{ type: 'text', text: `Error: ${err}` }]
            };
          }
        }
        articleUid =
          runState?.currentArticle?.uid || data.node.initialArticle.uid;
      }

      const data: GetArticleWithPropertiesQuery = await runbook.graphql({
        query: getArticleWithPropertiesQuery,
        variables: {
          articleUid
        }
      });
      const article: ArticleWithProperties = data.node;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                runState: runState
                  ? {
                      uid: runState.uid
                    }
                  : null,
                article: {
                  uid: article.uid,
                  name: article.name,
                  bodyMarkdown: article.bodyMarkdown,
                  properties: article.properties
                }
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
    withPrefix('run-process'),
    `This tool is used to start a new process or continue an existing one. If the run state UID is not provided, a new process will be created.`,

    {
      bookUid: z
        .string()
        .describe(
          `ID of the book. It always starts with 'bk_'. The book type must be 'workflow'.`
        ),
      articleUid: z
        .string()
        .describe(
          `ID of the article. It always starts with 'ar_'. The article UID is included in the return value of \`get-process\` and \`run-process\`.`
        ),
      runStateUid: z
        .string()
        .optional()
        .describe(
          `ID of the run state. It always starts with 'rs_'. If not provided, a new process will be created.`
        ),
      propertyValues: z
        .record(z.union([z.string(), z.array(z.string())]))
        .default({})
        .describe(
          `Property values to pass to the process. This is an object whose keys are strings and values are string or string[]. Properties correspond to \`::::input\` elements in the article body.
Only input elements with type="checkbox" can use string[] type.
# Example:

## article body

:::input text
<input type="text" name="3:dhks024mk2yhv7bkrskrp91myr" />
:::

:::input checkbox
<label><input type="checkbox" name="3:p8z0zknnpjjm70sahrbec8k440" value="SNS" checked />SNS</label>
<label><input type="checkbox" name="3:p8z0zknnpjjm70sahrbec8k440" value="YouTube" />YouTube</label>
:::

## property values

{
  "3:dhks024mk2yhv7bkrskrp91myr" : "text value",
  "3:p8z0zknnpjjm70sahrbec8k440" : ["SNS", "YouTube"]
}`
        )
    },
    async ({ bookUid, articleUid, runStateUid, propertyValues }) => {
      let article: ArticleWithProperties | null = null;
      let runState: RunProcessMutation['runProcess']['runState'] | null = null;
      const values = Object.entries(propertyValues).map(([propId, value]) => ({
        propId,
        value: Array.isArray(value) ? JSON.stringify(value) : value
      }));
      if (runStateUid) {
        const data: UpdateRunStateMutation = await runbook.graphql<
          any,
          UpdateRunStateMutation,
          UpdateRunStateMutationVariables
        >({
          query: updateRunStateQuery,
          variables: {
            uid: runStateUid,
            articleUid: articleUid,
            propertyValues: values
          }
        });
        article = data.updateRunState.nextArticle;
        runState = data.updateRunState.runState;
      } else {
        const data: RunProcessMutation = await runbook.graphql<
          any,
          RunProcessMutation,
          RunProcessMutationVariables
        >({
          query: runProcessQuey,
          variables: {
            bookUid,
            propertyValues: values
          }
        });
        article = data.runProcess.nextArticle;
        runState = data.runProcess.runState;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                runState: runState
                  ? {
                      uid: runState.uid
                    }
                  : null,
                nextArticle: article
                  ? {
                      uid: article.uid,
                      name: article.name,
                      bodyMarkdown: article.bodyMarkdown,
                      properties: article.properties
                    }
                  : null
              },
              null,
              2
            )
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

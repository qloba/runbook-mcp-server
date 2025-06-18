import Runbook from '@runbook-docs/client';
import {
  GetArticlesQuery,
  GetBooksQuery,
  GetCategoriesQuery,
  searchQuery
} from '@runbook-docs/client/dist/queries/types';
import getArticleQuery from '../queries/getArticle';
import getBookWithRunStatesQuery from '../queries/getBookWithRunStates';
import getBookWithRunStateQuery from '../queries/getBookWithRunState';
import getArticleWithPropertiesQuery from '../queries/getArticleWithProperties';
import runProcessQuery from '../queries/runProcess';
import getBookQuery from '../queries/getBook';
import updateRunStateQuery from '../queries/updateRunState';
import finishProcessQuery from '../queries/finishProcess';
import {
  RunState,
  GetBookQuery,
  GetArticleQuery,
  GetArticleWithPropertiesQuery,
  GetBookWithRunStatesQuery,
  GetBookWithRunStateQuery,
  UpdateRunStateMutation,
  UpdateRunStateMutationVariables,
  ArticleWithProperties,
  RunProcessMutation,
  RunProcessMutationVariables,
  FinishProcessMutation,
  FinishProcessMutationVariables
} from '../types';
import config from '../config';

const runbook = new Runbook(config);

function withPrefix(str: string) {
  const prefix = config.prefix || 'runbook';
  return `${prefix}-${str}`;
}

export const toolHandlers = {
  [withPrefix('search-articles')]: {
    description: `Search for articles using keywords from Runbook.
The result does not include full article bodies as they are truncated to 200 characters.
You will need to retrieve the full content by calling \`get-article\``,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description:
            'ID of the book or workspace. If provided, the result will be filtered by them.',
          default: 'all'
        },
        keywords: {
          type: 'string',
          description:
            'Space-separated keywords to filter articles. If multiple keywords are provided, the articles that match all of them will be returned. Use current language for keywords'
        },
        limit: {
          type: 'number',
          description: 'Number of articles to retrieve'
        },
        offset: {
          type: 'number',
          description: 'Offset of the search result'
        },
        orderBy: {
          type: 'string',
          enum: ['updatedAt', 'createdAt', 'score'],
          description: 'Sort the articles by the specified field',
          default: 'score'
        }
      },
      required: ['keywords']
    },
    handler: async (params: any) => {
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
  },

  [withPrefix('get-article')]: {
    description: 'Retrieve the article by its ID from the database.',
    inputSchema: {
      type: 'object',
      properties: {
        articleUid: {
          type: 'string',
          description:
            'ID of the article to retrieve. It always starts with `ar_`.'
        }
      },
      required: ['articleUid']
    },
    handler: async ({ articleUid }: { articleUid: string }) => {
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
  },

  [withPrefix('list-articles')]: {
    description: `List top 100 articles in a specified book with ID.
The result does not include full article bodies as they are truncated to 200 characters.
You will need to retrieve the full content by calling \`get-article\`.`,
    inputSchema: {
      type: 'object',
      properties: {
        bookUid: {
          type: 'string',
          description:
            "ID of the book. It always starts with 'bk_'. You can retrieve a list of books with `list-books`"
        },
        articleName: {
          type: 'string',
          description:
            'If provided, the result will be filtered by article name.'
        },
        categoryUid: {
          type: 'string',
          description:
            "ID of the category. It always starts with 'ca_'. You can retrieve a list of categories with `list-categories`"
        },
        orderBy: {
          type: 'string',
          enum: ['updatedAt', 'createdAt', 'name', 'popularity'],
          description: 'Sort the articles by the specified field'
        }
      },
      required: ['bookUid']
    },
    handler: async (props: any) => {
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
  },

  [withPrefix('list-books')]: {
    description: 'List top 100 books in the organization',
    inputSchema: {
      type: 'object',
      properties: {
        bookName: {
          type: 'string',
          description: 'If provided, the result will be filtered by book name.'
        }
      }
    },
    handler: async ({ bookName }: { bookName?: string }) => {
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
  },

  [withPrefix('list-categories')]: {
    description: 'List top 100 categories in a specified book with ID',
    inputSchema: {
      type: 'object',
      properties: {
        bookUid: {
          type: 'string',
          description:
            "ID of the book. It always starts with 'bk_'. You can retrieve a list of books with `list-books`"
        }
      },
      required: ['bookUid']
    },
    handler: async ({ bookUid }: { bookUid: string }) => {
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
  },

  [withPrefix('get-process')]: {
    description: 'Get current process information by book UID',
    inputSchema: {
      type: 'object',
      properties: {
        bookUid: {
          type: 'string',
          description:
            "ID of the book. It always starts with 'bk_'. The book type must be 'workflow'."
        },
        runStateUid: {
          type: 'string',
          description:
            "ID of the run state. It always starts with 'rs_'. If not provided, the first run state will be used."
        }
      },
      required: ['bookUid']
    },
    handler: async ({
      bookUid,
      runStateUid
    }: {
      bookUid: string;
      runStateUid?: string;
    }) => {
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
  },

  [withPrefix('run-process')]: {
    description:
      'This tool is used to start a new process or continue an existing one. If the run state UID is not provided, a new process will be created.',
    inputSchema: {
      type: 'object',
      properties: {
        bookUid: {
          type: 'string',
          description:
            "ID of the book. It always starts with 'bk_'. The book type must be 'workflow'."
        },
        articleUid: {
          type: 'string',
          description:
            "ID of the article. It always starts with 'ar_'. The article UID is included in the return value of `get-process` and `run-process`."
        },
        runStateUid: {
          type: 'string',
          description:
            "ID of the run state. It always starts with 'rs_'. If not provided, a new process will be created."
        },
        propertyValues: {
          type: 'object',
          description: `Property values to pass to the process. This is an object whose keys are strings and values are string or string[]. Properties correspond to \`::::input\` elements in the article body.
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
}
`,
          default: {}
        }
      },
      required: ['bookUid', 'articleUid']
    },
    handler: async ({
      bookUid,
      articleUid,
      runStateUid,
      propertyValues
    }: {
      bookUid: string;
      articleUid: string;
      runStateUid?: string;
      propertyValues?: Record<string, string | string[]>;
    }) => {
      let article: ArticleWithProperties | null = null;
      let runState: RunProcessMutation['runProcess']['runState'] | null = null;
      const values = Object.entries(propertyValues || {}).map(
        ([propId, value]) => ({
          propId,
          value: Array.isArray(value) ? JSON.stringify(value) : value
        })
      );
      const data = await runbook.graphql<
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
      if (!book || book.bookType !== 'workflow') {
        const err = `Book with UID ${bookUid} is not a workflow.`;
        return {
          content: [{ type: 'text', text: `Error: ${err}` }]
        };
      }
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
        if (articleUid && book.initialArticle.uid !== articleUid) {
          const err = `Invalid article UID. To create a new process, please specify the UID of the initial article in the book with UID ${bookUid} using \`get-process\`.`;
          return {
            content: [{ type: 'text', text: `Error: ${err}` }]
          };
        }
        const data: RunProcessMutation = await runbook.graphql<
          any,
          RunProcessMutation,
          RunProcessMutationVariables
        >({
          query: runProcessQuery,
          variables: {
            bookUid,
            propertyValues: values
          }
        });
        article = data.runProcess.nextArticle;
        runState = data.runProcess.runState;
      }
      let message = null;
      if (runState.readyToFinish) {
        // If the run state is ready to finish, we can call finishProcess
        const data: FinishProcessMutation = await runbook.graphql<
          any,
          FinishProcessMutation,
          FinishProcessMutationVariables
        >({
          query: finishProcessQuery,
          variables: {
            uid: runState.uid
          }
        });
        runState = data.finishProcess.runState;
        message = data.finishProcess.finishMessage;
        article = null;
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                runState: runState
                  ? {
                      uid: runState.uid,
                      status: runState.status
                    }
                  : null,
                nextArticle: article
                  ? {
                      uid: article.uid,
                      name: article.name,
                      bodyMarkdown: article.bodyMarkdown,
                      properties: article.properties
                    }
                  : null,
                message
              },
              null,
              2
            )
          }
        ]
      };
    }
  }
};

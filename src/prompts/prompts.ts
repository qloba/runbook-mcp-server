import { McpState } from '../state';

export const promptHandlers = function (state: McpState) {
  const withPrefix = function (str: string) {
    return `${state.name}-${str}`;
  };
  return {
    [withPrefix('execute-workflow')]: {
      name: withPrefix('execute-workflow'),
      title: 'Execute Workflow',
      description:
        'Execute a Runbook workflow process step by step with user confirmation',
      arguments: [],
      prompt: `Please execute the process according to the following steps:

1. Determine the workflow bookUid from the current context. It may be given directly as a bookUid (starting with "bk_") or as a Runbook article URL. If it is a URL, first call \`${withPrefix('get-article')}\` with that URL to retrieve the article, and use the bookUid from the article's book field as the workflow bookUid for subsequent steps.
2. Check the current process information with \`${withPrefix('get-process')}\` and follow the instructions in the article.
3. Execute the process with \`${withPrefix('run-process')}\`. Before sending, confirm the contents of property_values with the user.
4. If the returned value contains nextArticle, follow its instructions and execute \`${withPrefix('run-process')}\` again.
5. Repeat this until the process is complete.

Important notes:
- Always respond in the user's language (default is Japanese)
- Always confirm the contents of property_values with the user before sending
- Carefully read and follow the instructions in the article at each process step
- If an error occurs, display an appropriate error message in the user's language`
    }
  };
};

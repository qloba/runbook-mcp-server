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
      arguments: [
        {
          name: 'bookUid',
          description:
            'ID of the workflow book to execute. Must start with "bk_" and be of type "workflow".',
          required: false
        }
      ],
      prompt: `Please execute the process according to the following steps:

1. Check the current process information with \`${withPrefix('get-process')}\` and follow the instructions in the article.
2. Execute the process with \`${withPrefix('run-process')}\`. Before sending, confirm the contents of property_values with the user.
3. If the returned value contains nextArticle, follow its instructions and execute \`${withPrefix('run-process')}\` again.
4. Repeat this until the process is complete.

Important notes:
- Always respond in the user's language (default is Japanese)
- Always confirm the contents of property_values with the user before sending
- Carefully read and follow the instructions in the article at each process step
- If an error occurs, display an appropriate error message in the user's language`
    }
  };
};

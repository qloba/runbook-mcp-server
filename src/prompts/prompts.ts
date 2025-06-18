import config from '../config';

function withPrefix(str: string) {
  const prefix = config.prefix || 'runbook';
  return `${prefix}-${str}`;
}

export const promptHandlers = {
  [withPrefix('execute-workflow')]: {
    name: withPrefix('execute-workflow'),
    description:
      'Execute a Runbook workflow process step by step with user confirmation',
    arguments: [
      {
        name: 'bookUid',
        description:
          'ID of the workflow book to execute. Must start with "bk_" and be of type "workflow".',
        required: true
      },
      {
        name: 'runStateUid',
        description:
          'Optional ID of existing run state to continue. If not provided, starts a new process.',
        required: false
      }
    ],
    prompt: `以下の手順でプロセスを実行してください。

1. \`${withPrefix('get-process')}\`で現在のプロセス情報を確認し、articleの指示に従ってください。
2. \`${withPrefix('run-process')}\`でプロセスを実行します。送信する前にproperty_valuesの入力内容をユーザーに確認してください。
3. 戻り値のnextArticleが存在すれば、さらにその指示に従い、\`${withPrefix('run-process')}\`を実行します。
4. これを繰り返してプロセスを完了してください。

引数:
- bookUid: {{bookUid}}
{{#if runStateUid}}- runStateUid: {{runStateUid}}{{/if}}

重要な注意事項:
- property_valuesを送信する前に、必ずユーザーに内容を確認してください
- プロセスの各ステップで、記事の指示を注意深く読んで従ってください
- エラーが発生した場合は、適切なエラーメッセージを表示してください`
  }
};

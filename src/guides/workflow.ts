// The workflow authoring guide, shared by the create-workflow prompt (invoked
// by the user) and the get-workflow-guide tool (called by the model itself).
export function workflowGuide(withPrefix: (str: string) => string): string {
  return `You are going to build the content of a Runbook **workflow** with the Runbook MCP tools: the steps of the process and the input forms on each step. Read this whole guide first. It explains what a workflow is in Runbook, what you are expected to do and what is left to a human, and the exact Markdown syntax that turns into form fields.

Talk to the user in their language. Write article names, field names and help text in the language the workflow's users work in.

## What a workflow is in Runbook

- A **workflow book** (\`bookType: workflow\`) is the template of one business process, such as an expense claim, an onboarding checklist or an incident report. A document book (\`bookType: document\`) is a plain manual; the form syntax below only means something in a workflow book.
- Each **article** in a workflow book is **one step** (one screen) of the process. A person running the process reads the step's text, fills in its form and proceeds to the next step. A step can be pure instructions with no fields, a form, or both.
- The **order of the steps** is the order of the articles in the book's folder tree, from top to bottom, with folders' contents in place. Folders group related steps. \`${withPrefix('create-article')}\` always adds the article to the end of the root folder, so create the steps in the order they should run.
- Every workflow book starts with one **initial article** (named "始めましょう" / "Let's get started", slug \`home\`). It is always the first step and cannot be deleted or moved. Use it as the first step by rewriting it with \`${withPrefix('update-article')}\` (typically an overview of the process, plus the first form) instead of leaving it empty and adding another first step.
- Each time someone runs the workflow, Runbook creates a **process** (a run state, \`rs_…\`) that stores the values entered on every step. These values are what the conditions, notifications and integrations configured by a human work with.

## Who does what

**You (the AI) do:**

- Design the steps of the process with the user.
- Write each step as an article: the instructions, and the form fields as \`:::input\` blocks.
- Revise existing steps when asked.

**A human does, in the Runbook web UI. Do not try to do these, and do not look for tools that do them:**

- Creating the workflow book itself and changing its settings.
- Creating folders and reordering steps.
- **Conditional branching**: showing or hiding steps and folders depending on the values entered.
- **Assignees** of each step (who must work on it).
- **Workflow actions**: email notifications, webhooks and other integrations, and when they are triggered.

If the book does not exist yet, ask the user to create a workflow book and tell you its name or URL, then find its \`bookUid\` (\`bk_…\`) with \`${withPrefix('list-books')}\` and check that its \`bookType\` is \`workflow\`.

Design with these settings in mind even though you do not make them. When a step only applies in some cases, or needs a specific assignee or a notification, write the step anyway and note what the human has to configure (see "Hand-off").

## Procedure

1. **Understand the process.** Ask the user what the process is for, who takes part, what information is collected at each stage and which cases branch. Ask only what you cannot reasonably infer.
2. **Inspect the book.** Call \`${withPrefix('get-folder')}\` with the \`bookUid\` to see the existing steps and folders, and \`${withPrefix('get-article')}\` for every step you are going to change, including the initial article.
3. **Propose the step list** before writing: for each step, its name, its purpose, its fields (name, type, required, choices) and who works on it. Let the user confirm or adjust it. A good split is one step per person or phase, for example "申請" (the requester fills in the claim), "上長承認" (the manager reviews it) and "経理処理" (accounting pays it).
4. **Write the steps** in order: \`${withPrefix('update-article')}\` for the initial article, then \`${withPrefix('create-article')}\` for each following step.
5. **Verify** each step with \`${withPrefix('get-article')}\` (see "Verification").
6. **Hand off** the remaining settings to the user.

Do not call \`${withPrefix('run-process')}\` to test the workflow: it creates a real process, and can notify the assignees and run the configured actions. \`${withPrefix('get-process')}\` is read-only and safe to use.

## Form fields: the \`:::input\` block

The Markdown body sent to \`${withPrefix('create-article')}\` / \`${withPrefix('update-article')}\` is converted into the editor's content, and every \`:::input\` block becomes a form field.

\`\`\`
:::input <type> { uid="<id>" <attributes…> }
<field name>
<help text (optional)>
<choices (select / radio / checkbox only)>
:::
\`\`\`

1. **Opening line**: \`:::input\`, the field type, and the attributes in braces. The braces and the \`uid\` attribute are mandatory: **a block without \`uid\` is silently dropped.**
   - For a **new field**, write a placeholder that is unique within the article: \`uid="new1"\`, \`uid="new2"\`, … Runbook replaces it with a real ID when the article is saved.
   - For an **existing field**, keep the \`uid\` exactly as \`${withPrefix('get-article')}\` returned it (such as \`uid="3:dhks024mk2yhv7bkrskrp91myr"\`).
2. **Second line**: the field name. Mandatory. It is shown in bold above the field, and the human picks fields by this name when setting up conditions and notifications, so keep it short and unique within the workflow.
3. **Third line (optional)**: help text shown under the name, on a single line. It must not start with \`<\`, or it is read as markup.
4. **Choices**, for \`select\`, \`radio\` and \`checkbox\` only, written as the HTML shown below. Other types need nothing more: the HTML that \`${withPrefix('get-article')}\` shows for them is ignored on import and can be left out.
5. **Closing line**: \`:::\` alone on its line, with nothing after it.

Leave a blank line before and after each block. Blocks must sit at the **top level** of the article: never put one inside a list, quote, table, callout or \`:::details\` block (a field inside \`:::details\` makes the whole save fail).

### Field types

| Type | Use for | Value |
|---|---|---|
| \`text\` | Short single-line text (names, titles, codes) | string |
| \`textarea\` | Multi-line text (reasons, details, comments) | string |
| \`email\` | Email address | must be a valid address |
| \`url\` | URL | string |
| \`number\` | Amounts, quantities | must be a number |
| \`date\` | Date | \`YYYY-MM-DD\` |
| \`time\` | Time | \`HH:MM\` |
| \`datetime\` | Date and time | \`YYYY-MM-DDTHH:MM\` |
| \`select\` | One choice from a drop-down; suits long lists | one of the choices |
| \`radio\` | One choice shown as buttons; suits 2-5 choices | one of the choices |
| \`checkbox\` | Any number of choices | list of choices |
| \`file\` | File upload | uploaded files |

### Attributes

| Attribute | Meaning |
|---|---|
| \`uid="…"\` | Field ID. Mandatory (see above). |
| \`required=true\` | The step cannot be completed while the field is empty. Default \`false\`. |
| \`readOnly=true\` | The person cannot edit the value; it keeps the default value. Use with \`defaultSource\`. Default \`false\`. |
| \`defaultSource="…"\` | Where the initial value comes from: \`static\` (the \`defaultValue\` below), \`user_name\` / \`user_email\` (the name / email address of the person running the step), \`custom_user_field\` (a custom user field, whose key goes in \`defaultValue\`), \`now\` (the current date / time, for \`date\`, \`time\` and \`datetime\`). |
| \`defaultValue="…"\` | The initial value for \`defaultSource="static"\`. For \`select\`, \`radio\` and \`checkbox\` it must be one of the choices. |
| \`alignment="…"\` | \`horizontal\` or \`vertical\` layout of the choices. \`radio\` and \`checkbox\` only. |
| \`maxFiles=N\` | Maximum number of files. \`file\` only. |

Quote string values with double quotes; \`true\`, \`false\` and numbers need no quotes.

### Choices

Choices are read from the \`value\` attribute of the markup. The value is what gets stored, so it is also what a human's branching conditions compare against: keep values short and stable, and do not rename them once the workflow is in use. Do not use \`"\` in a value.

\`select\`:

\`\`\`
:::input select { uid="new1" required=true }
部署
<select>
<option value="営業部">営業部</option>
<option value="開発部">開発部</option>
<option value="管理部">管理部</option>
</select>
:::
\`\`\`

\`radio\` and \`checkbox\`: one \`<label>\` per line, with \`type\` written before \`value\`:

\`\`\`
:::input radio { uid="new2" required=true alignment="horizontal" }
申請区分
<label><input type="radio" value="新規" />新規</label>
<label><input type="radio" value="変更" />変更</label>
<label><input type="radio" value="廃止" />廃止</label>
:::
\`\`\`

### Example step

\`\`\`markdown
立て替えた経費の精算を申請します。領収書を必ず添付してください。

:::callout info
申請後、上長の承認を経て経理部が処理します。
:::

## 申請者

:::input text { uid="new1" required=true readOnly=true defaultSource="user_name" }
申請者
:::

:::input email { uid="new2" required=true readOnly=true defaultSource="user_email" }
メールアドレス
:::

## 経費の内容

:::input date { uid="new3" required=true defaultSource="now" }
支払日
:::

:::input select { uid="new4" required=true }
費目
<select>
<option value="交通費">交通費</option>
<option value="会議費">会議費</option>
<option value="消耗品費">消耗品費</option>
<option value="その他">その他</option>
</select>
:::

:::input number { uid="new5" required=true }
金額（円）
税込金額を入力してください
:::

:::input textarea { uid="new6" required=true }
内容
支払先と用途を具体的に記入してください
:::

:::input file { uid="new7" required=true maxFiles=5 }
領収書
:::
\`\`\`

## Writing good steps

- Start each step with a sentence or two on what the person does in this step and why. Put caveats in \`:::callout warning\`.
- Group the fields of a long form under \`##\` headings. Never use \`#\`, which is the article title.
- Ask for each piece of information once in the whole workflow; do not make a later step re-enter what an earlier step collected.
- On review or approval steps, collect the decision as a field, such as a \`radio\` "承認結果" with "承認" / "差し戻し" and a \`textarea\` "コメント", so the human can branch and notify on it.
- Mark a field \`required\` only when the process cannot go on without it.
- Fill in what is already known about the person with \`defaultSource\` (\`user_name\`, \`user_email\`, \`now\`) instead of making them type it.
- The article name is the step name shown in the process. Keep it short and action-oriented ("申請内容の入力", "上長承認").

## Changing an existing step

1. Call \`${withPrefix('get-article')}\` and start from the Markdown it returns. Existing fields come back as \`:::input\` blocks with their real \`uid\`.
2. Keep those \`uid\`s unchanged. The human's conditions and notifications, and the values stored in processes already run, refer to fields by these IDs. A field whose \`uid\` changes, or that is removed, breaks them, and changing a field's type or choices can break conditions too. Tell the user before removing a field or changing its type or choices.
3. Use new placeholders (\`uid="new1"\`, …) only for the fields you add.
4. Send the whole body back with \`${withPrefix('update-article')}\`: \`bodyMarkdown\` replaces the entire body.

## Verification

After creating or updating a step, call \`${withPrefix('get-article')}\` and check that:

- every field you wrote is there. A missing field means its block was malformed, most often a missing \`uid\` or a closing line that is not exactly \`:::\`;
- the placeholders were replaced by real IDs (\`uid="<number>:<id>"\`);
- the types, \`required\` flags, defaults and choices are what you intended.

Fix any problem with \`${withPrefix('update-article')}\`, keeping the IDs that were assigned.

## Hand-off

When the steps are written, give the user:

1. The steps in order, with a link to each article.
2. What to set up in the Runbook web UI, naming steps and fields:
   - folders and reordering, if the steps should be grouped or moved;
   - conditional branching, for example "show the step '部長承認' only when '金額（円）' is 100000 or more";
   - the assignees of each step;
   - workflow actions, for example "email the requester when '承認結果' is '差し戻し'".`;
}

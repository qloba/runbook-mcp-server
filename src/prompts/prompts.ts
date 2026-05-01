import { McpState } from '../state';

export const promptHandlers = function (state: McpState) {
  const withPrefix = function (str: string) {
    return `${state.name}-${str}`;
  };
  return {
    [withPrefix('init')]: {
      name: withPrefix('init'),
      title: 'Runbook Skill Bootstrap',
      description:
        'Bootstrap a Runbook skill file with the current environment snapshot',
      arguments: [],
      prompt: `# ${withPrefix('init')} prompt

This is the MCP prompt body. It will be returned by the \`${withPrefix('init')}\` prompt of the Runbook MCP server. The user invokes it once per Runbook environment to bootstrap a per-environment skill file.

---

You are bootstrapping a reusable skill that lets an AI agent (you, in future sessions) work efficiently against this Runbook environment without re-discovering its structure every time. Your job in this session is to produce a single \`SKILL.md\` file that captures the current book layout and the operational patterns for using the Runbook MCP tools.

Do all of the following in one go. Don't pause to ask the user for confirmation between steps unless something is genuinely ambiguous.

## Goal

Produce a \`SKILL.md\` file that:

1. Has YAML frontmatter (\`name\`, \`description\`) tuned to trigger reliably when the user mentions Runbook, any book name, "manual", "workflow", "documentation", "runbook", or domain-specific book names found in this environment.
2. Embeds a static cache of all books in this Runbook environment, grouped by \`bookType\` (document vs. workflow) and by workspace, with \`bookUid\` clearly visible.
3. Documents the operational patterns the agent should follow when calling Runbook MCP tools — tool selection, search retry strategy, workflow execution order, zero-hit fallback behavior.
4. Stands on its own. A future agent reading only this file (with no access to this conversation) should be able to do useful Runbook work immediately.

## What you have

This Runbook MCP server exposes these tools (the exact prefix may differ — e.g. \`${withPrefix('list-books')}\`, \`Runbook:${withPrefix('list-books')}\`, or \`mcp__<id>__${withPrefix('list-books')}\`. Use whichever form your client surfaces):

- \`${withPrefix('list-books')}\` — list all books in the org (returns up to 100)
- \`${withPrefix('list-articles')}\` — list articles in a book (returns up to 100, bodies truncated to 200 chars)
- \`${withPrefix('search-articles')}\` — keyword search across articles, AND-matching, optional \`scope\` (bookUid or workspace UID)
- \`${withPrefix('list-categories')}\` — list categories within a book
- \`${withPrefix('get-article')}\` — fetch full article body by \`ar_…\` UID or by URL
- \`${withPrefix('create-article')}\` / \`${withPrefix('update-article')}\` — create/update articles in Markdown
- \`${withPrefix('get-process')}\` — read a workflow's current state and its \`:::input\` definitions (call this BEFORE \`run-process\`)
- \`${withPrefix('run-process')}\` — start or continue a workflow run, passing \`propertyValues\`
- \`${withPrefix('upload-run-state-file')}\` — get a presigned URL for file uploads, then PUT the file via HTTP

UID prefixes: \`bk_\` (book), \`ar_\` (article), \`ca_\` (category), \`rs_\` (run state). Mixing them up causes 403/404.

## Steps

### 1. Inventory the environment

Call \`${withPrefix('list-books')}\` with no filter. Capture every book's \`uid\`, \`name\`, \`bookType\`, \`description\`, and \`workspace.name\`. Don't paginate manually — if the org has more than ~100 books, mention this caveat in the SKILL.md and use \`bookName\` filtering as a fallback strategy.

### 2. Group the books

Split the result into two tables: \`document\` books and \`workflow\` books. Within each, sort by workspace name so books from the same workspace cluster together. For each book, write a short purpose hint — derive it from \`description\` if present, otherwise infer from the name (keep these hints short, one line each).

If a book has an empty \`description\` and an opaque name (e.g. just "Misc" or a code), it's fine to leave the purpose hint blank or write "miscellaneous".

### 3. Build the description frontmatter

Skim the book names. Pull out 5–10 distinctive book names (especially ones that look like they get referenced by name in everyday conversation — e.g. "API Reference", "Developer Spec", "Daily Report", "Weather Notification") and weave them into the description so the skill triggers when the user mentions any of them.

The description should be assertive ("always use this skill when …") rather than tentative — skills tend to under-trigger.

### 4. Write the SKILL.md body

Use the template below. Adapt headings to the user's working language if it's clearly not English (check the book names and descriptions — if they're mostly Japanese, write the SKILL.md in Japanese; same for any other language). The structure stays the same regardless of language.

\`\`\`markdown
---
name: runbook
description: <assertive 2-4 sentence description naming the platform, listing 5-10 distinctive book names from this org, and stating that this skill must be consulted whenever Runbook books or workflows are mentioned>
---

# Runbook skill

<one-paragraph intro: what Runbook is in this org, what this skill is for>

## When to use

<bullet list of triggering phrases — "find the X manual", "run the Y workflow", "look up Z reference", plus a generic "any time a book name from the cache below comes up">

## Basic workflow

1. Identify the target book from the cache below.
2. Pick the right tool based on intent:
   - Find articles → \`${withPrefix('list-articles')}\` or \`${withPrefix('search-articles')}\`
   - Read article body → \`${withPrefix('get-article')}\`
   - Create/update article → \`${withPrefix('create-article')}\` / \`${withPrefix('update-article')}\`
   - Run a workflow → see "Workflow execution" below
3. Only call \`${withPrefix('list-books')}\` if the user mentions a book that isn't in the cache or asks for the freshest list.

## Book cache

<intro line: "Static snapshot from <ISO date>. Refresh with ${withPrefix('list-books')}  if a referenced book is missing.">

### 📘 Document books

| Workspace | Book | bookUid | Purpose |
|---|---|---|---|
| <workspace> | <name> | \`<bk_…>\` | <short hint> |
…

### ⚙️ Workflow books

| Workspace | Book | bookUid | Purpose |
|---|---|---|---|
…

### Cache refresh rules

- If the user names a book not in the tables above, call \`${withPrefix('list-books')}\` with no filter and treat the result as the new cache for the rest of the session.
- "Show me all books" or "give me the latest list" also triggers a refresh.

### How to call list-books

The \`bookName\` filter does substring-ish matching that misses on slight variations. Default to calling \`${withPrefix('list-books')}\` with no filter — the result is small. Only use \`bookName\` when you're sure of the exact spelling. If \`bookName\` returns 0 results, always retry without it before concluding the book doesn't exist.

## Finding and reading articles

**Need a list of articles in a known book** → \`${withPrefix('list-articles')}\` with \`bookUid\`. Bodies are truncated to 200 chars.

**Need to keyword-search** → \`${withPrefix('search-articles')}\`. Pass \`scope\` (a bookUid or workspace UID) when you can to cut noise. Keywords are space-separated AND-matching. \`orderBy\` accepts \`score\`, \`updatedAt\`, \`createdAt\`.

**Need the full article body** → take the \`ar_…\` from a list/search result and call \`${withPrefix('get-article')}\`. If the user pasted an article URL, you can pass the URL straight to \`articleUid\`.

**Need category-level filtering inside a book** → \`${withPrefix('list-categories')}\` for the \`bookUid\`, then pass the \`ca_…\` to \`${withPrefix('list-articles')}\` as \`categoryUid\`.

### Search retry strategy

Don't bail on the first empty result. In order:

1. **AND match returned 0** → split the keywords and search them individually.
2. **Scoped search returned 0** → drop \`scope\` and search the whole org.
3. **Still 0** → propose related terms, ask the user for synonyms, or surface partial-match candidates.

A blunt "not found" is the last resort, not the first response.

## Creating and updating articles

\`${withPrefix('create-article')}\` / \`${withPrefix('update-article')}\` take Markdown. Important conventions:

- Headings start at \`##\`. \`# H1\` is reserved for the article title.
- Callouts: \`:::callout info … :::\` or \`:::callout warning … :::\`.
- Mermaid: standard \` \`\`\`mermaid \` fenced block.
- Tables: GFM syntax.

For updates, \`articleUid\` is required. Omitting \`bodyMarkdown\` leaves the body unchanged and only updates \`name\` / \`categoryUids\`.

## Workflow execution

For any \`bookType: workflow\`, follow this order strictly. Don't call \`${withPrefix('run-process')}\` cold.

1. **\`${withPrefix('get-process')}\`** with the \`bookUid\` (and \`runStateUid\` if continuing). Read the returned \`articleUid\` and the \`:::input\` elements in the body.
2. **Build \`propertyValues\`** from the \`:::input\` definitions. Keys are the \`name\` attributes (e.g. \`1:abc…\`). Values are strings, except \`checkbox\` inputs which take \`string[]\`.
3. **\`${withPrefix('run-process')}\`** with \`bookUid\`, \`articleUid\`, and \`propertyValues\`. Omit \`runStateUid\` for new runs.
4. **File inputs**: call \`${withPrefix('upload-run-state-file')}\` to get a presigned URL, PUT the file via HTTP, then put the returned \`uid\` into \`propertyValues\` as a one-element array.
5. If the returned value contains \`nextArticle\`, follow its instructions and execute \`${withPrefix('run-process')}\` again.
6. Repeat this until the process is complete.

Even for routine workflows, re-check \`:::input\` with \`${withPrefix('get-process')}\` first — field layouts can change.

## Notes

- UID prefixes: \`bk_\` book, \`ar_\` article, \`ca_\` category, \`rs_\` run state. Mixing them up returns 403/404.
- Calling \`${withPrefix('run-process')}\` against a \`document\` book errors out, and vice versa.
- \`${withPrefix('list-articles')}\` caps at 100. For larger books, lean on \`${withPrefix('search-articles')}\` or category-by-category enumeration.
- When the user's book reference is ambiguous and multiple cached books match, briefly ask which one before proceeding.

## Zero-hit fallback

When a book lookup or article search comes back empty, never end the turn there. Do at least one of:

- **Suggest a near-match book** (substring overlap, same workspace, same \`bookType\`).
- **Suggest adjacent books** in the same domain (e.g. if "Tech Notes" is empty, also try the workspace's other doc books).
- **Ask for related keywords** — synonyms, English vs. local language variants, product-name alternatives.

End every empty result with at least one concrete next move offered to the user.
\`\`\`

### 5. Save the file

Save the SKILL.md to wherever your current agent environment loads skills, rules, or persistent instructions from. The exact path depends on the client and is the user's call — don't hardcode assumptions.

Decide where to write it using this priority:

1. **Inspect the working directory.** If you can see existing skill/rule directories or config files for the agent you're running in, follow the same convention and place the new file alongside them.
2. **Check for environment hints.** Files like \`README\`, \`.gitignore\`, or other agent-config artifacts in the project often reveal the conventional location.
3. **Ask the user.** If neither of the above gives a clear answer, ask the user where they'd like the skill installed before writing — they know their setup better than you do.
4. **Fall back to project root.** If asking isn't an option (non-interactive run), write to the project root as \`${withPrefix('skill.md')}\` and tell the user to move it into place.

If your agent environment uses a frontmatter format different from the YAML used in the template (e.g. a different rule format with its own metadata fields), translate the frontmatter to match while keeping the body intact.

If you can't write files directly at all (read-only environment, no filesystem tool), output the full SKILL.md contents in a fenced code block and tell the user where to save it.

### 6. Quick verification

After writing, do a self-check pass — don't run a full eval, but confirm:

- Frontmatter \`name\` and \`description\` are present and non-empty.
- Both Document and Workflow tables have at least one row each (or, if the org genuinely has only one type, note that explicitly).
- Every \`bk_…\` UID in the tables came from the actual \`${withPrefix('list-books')}\` response (no hallucinated IDs).
- The "Workflow execution" section explicitly says to call \`get-process\` before \`run-process\`.

Report back to the user with: where you saved the file, how many books are in each table, and one-line confirmation that the skill is ready to use in future sessions.

## Quality bar

- Tables, not prose, for the book cache. Tables are scannable at a glance.
- Every \`bookUid\` wrapped in backticks so the agent can copy it cleanly.
- Workspace names stay together — sort by workspace within each table.
- If \`bookType: document\` and \`bookType: workflow\` are the only two values you see, don't invent a third category.
- Don't pad the file with generic Runbook marketing copy. Every section should be operationally useful to a future agent.

## What not to do

- Don't call \`${withPrefix('list-articles')}\` or \`${withPrefix('search-articles')}\` during bootstrap — you're cataloguing books, not articles. Article-level discovery happens later, on demand.
- Don't try to test workflows by actually running them. \`${withPrefix('get-process')}\` is read-only and fine to call for spot-checking, but don't trigger \`${withPrefix('run-process')}\`.
- Don't write the skill in a way that hardcodes specific articles by UID unless the user explicitly mentions a recurring task tied to that article. Article UIDs are more volatile than book UIDs.
- Don't ask the user to confirm the book list before writing the skill. The list is what it is — write it down and move on.

Begin now: call \`${withPrefix('list-books')}\` and proceed through the steps.`
    }
  };
};

# Runbook MCP server

This MCP server integrates with [Runbook](https://www.runbook.jp) to allow listing, reading, and searching over documents.

## Components

### Tools

- **`get-article`**
  - Retrieve the article by its ID from the database.
  - Required inputs:
    - `articleUid` (string): ID of the article to retrieve. It always starts with `ar_`.
- **`list-articles`**
  - List top 100 articles in a specified book with ID. The result does not include full article bodies as they are truncated to 200 characters. You will need to retrieve the full content by calling `get-article`.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\`.
  - Optional inputs:
    - `articleName` (string): If provided, the result will be filtered by article name.
    - `categoryUid` (string): ID of the category. It always starts with 'ca_'. You can retrieve a list of categories with \`list-categories\`.
    - `orderBy` (string): Sort field (updatedAt, createdAt, 'name', or 'popularity').
- **`create-article`**
  - Create a new article in a specified book with ID. The article body is in Markdown format. The article will be created in the root folder of the book. You can specify categories for the article by their IDs, which always start with 'ca_'. You can retrieve a list of books with \`list-books\` and categories with \`list-categories\`.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\`.
    - `name` (string): Name of the article to create.
  - Optional inputs:
    - `bodyMarkdown` (string): Body of the article in Markdown format. If not provided, an empty article will be created.
    - `categoryUids` (array): IDs of the categories to assign to the article. Each ID starts with 'ca_'. You can retrieve a list of categories with \`list-categories\`.
- **`update-article`**
  - Update an existing article by its ID. The article body is in Markdown format. You can specify categories for the article by their IDs, which always start with 'ca_'.
  - Required inputs:
    - `articleUid` (string): ID of the article to update. It always starts with `ar_`. You can retrieve a list of articles with \`list-articles\`.
  - Optional inputs:
    - `name` (string): Name of the article to update.
    - `bodyMarkdown` (string): Body of the article in Markdown format. If not provided, the body will not be updated.
    - `categoryUids` (array): IDs of the categories to assign to the article. Each ID starts with 'ca_'. You can retrieve a list of categories with \`list-categories\`.
- **`list-books`**
  - List top 100 books in the organization.
  - Optional inputs:
    - `bookName` (string): If provided, the result will be filtered by book name.
- **`list-categories`**
  - List top 100 categories in a specified book with ID.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\`.
- **`search-articles`**
  - Search for articles using keywords from Runbook. The result does not include full article bodies as they are truncated to 200 characters. You will need to retrieve the full content by calling \`get-article\`.
  - Required inputs:
    - `keywords` (string): Space-separated keywords to filter articles. If multiple keywords are provided, the articles that match all of them will be returned. Use current language for keywords.
  - Optional inputs:
    - `scope` (string): ID of the book or workspace. If provided, the result will be filtered by them. Default: all.
    - `limit` (number): Number of articles to retrieve.
    - `offset` (number): Offset of the search result.
    - `orderBy` (string): Sort field (updatedAt, createdAt, or 'score'). Default: score.
- **`get-process`**
  - Get current process information by book UID.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. The book type must be 'workflow'.
  - Optional inputs:
    - `runStateUid` (string): ID of the run state. It always starts with 'rs_'. If not provided, the first run state will be used.
- **`run-process`**
  - This tool is used to start a new process or continue an existing one. If the run state UID is not provided, a new process will be created.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. The book type must be 'workflow'.
    - `articleUid` (string): ID of the article. It always starts with 'ar_'. The article UID is included in the return value of \`get-process\` and \`run-process\`.
  - Optional inputs:
    - `runStateUid` (string): ID of the run state. It always starts with 'rs_'. If not provided, a new process will be created.
    - `propertyValues` (object): Property values to pass to the process. This is an object whose keys are strings and values are string or string[]. Properties correspond to \`::::input\` elements in the article body. Only input elements with type="checkbox" can use string[] type.

## Requirements

- Node.js >= v20.0.0

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

#### Configure Claude Desktop

**Recommended: Install as Desktop Extension (.dxt)**

For the easiest setup, download and install the .dxt file from the [releases page](https://github.com/qloba/runbook-mcp-server/releases). This will automatically configure the MCP server in Claude Desktop. For more information about desktop extensions, see the [Anthropic documentation](https://www.anthropic.com/engineering/desktop-extensions).

**Manual Configuration**

Alternatively, add the following to your claude_desktop_config.json:

```json
{
  "mcpServers": {
    "runbook": {
      "command": "npx",
      "args": [
        "-y",
        "@runbook-docs/mcp-server"
      ],
      "env": {
        "RUNBOOK_BASE_URL": "https://<YOUR_SUBDOMAIN>.runbook.jp",
        "RUNBOOK_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Configure Cursor

Add MCP server with following command.

```
npx -y @runbook-docs/mcp-server --api-token=your-api-tokan --base-url=https://yourdomain.runbook.jp
```

## Markdown Format

When creating or updating articles, the body content uses Markdown format with the following supported elements:

- **Headers**: `## H2`, `### H3`, `#### H4`. Don't use `# H1` as it is reserved for the article title.
- **Bold**: `**bold text**`
- **Italic**: `_italic text_`
- **Lists**: `- item` or `1. numbered item`
- **Links**: `[text](url)`
- **Code blocks**: 
  ````
  ```
  code
  ```
  ````
- **Tables**: 
  ```
  | col1 | col2 |
  | --- | --- |
  | data | data |
  ```
- **Blockquotes**: `> quoted text`
- **Callouts**: 
  ```
  :::callout info
  text
  :::
  ```
  ```
  :::callout warning
  text
  :::
  ```
- **Diagrams**: 
  ````
  ```mermaid
  graph TD;
  ```
  ````

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

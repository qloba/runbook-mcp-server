# Runbook MCP server

This MCP server integrates with [Runbook](https://www.runbook.jp) to allow listing, reading, and searching over documents.

## Components

### Tools

- **`get-article`**
  - Retrieve the article by its ID from the database.
  - Required inputs:
    - `articleUid` (string): ID of the article to retrieve. It always starts with `ar_`.
- **`list-articles`**
  - List top 50 articles in a specified book with ID.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\`.
  - Optional inputs:
    - `q` (string): Search query. If provided, the result will be filtered by article name.
    - `categoryUid` (string): ID of the category. It always starts with 'ca_'. You can retrieve a list of categories with \`list-categories\`.
    - `orderBy` (string): Sort field (updatedAt, createdAt, 'name', or 'popularity'). Default: popularity.
- **`list-books`**
  - List top 100 books in the organization.
  - Optional inputs:
    - `q` (string): Search query. If provided, the result will be filtered by book name.
- **`list-categories`**
  - List top 100 categories in a specified book with ID.
  - Required inputs:
    - `bookUid` (string): ID of the book. It always starts with 'bk_'. You can retrieve a list of books with \`list-books\`.
- **`search-articles`**
  - Search articles by a query string.
  - Required inputs:
    - `keywords` (string): Space-separated keywords to filter articles.
  - Optional inputs:
    - `scope` (string): ID of the book or workspace. You can retrieve a list of books with \`list-books\`.
    - `limit` (number): Number of articles to retrieve.
    - `offset` (number): Offset of the search result.
    - `orderBy` (string): Sort field (updatedAt, createdAt, or 'score'). Default: score.

## Requirements

- Node.js >= v20.0.0

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

#### Configure Claude Desktop

Add the following to your claude_desktop_config.json

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

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
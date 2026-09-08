export default `
  fragment Book on Book {
    uid
    name
    description
    bookType
    rootFolder {
      uid
    }
    initialArticle {
      uid
      name
      bodyMarkdown
    }
    workspace {
      uid
      name
      description
    }
  }
`;

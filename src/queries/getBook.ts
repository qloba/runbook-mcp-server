export default `
  query getBook(
    $bookUid: ID!
  ) {
    node(id: $bookUid) {
      ... on Book {
        __typename
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
    }
  }
`;

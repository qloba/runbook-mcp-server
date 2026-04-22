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

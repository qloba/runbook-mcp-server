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
        pathname
        bookType
        contentsLayout
        hideFolders
        sortOrder
        isHidden
        initialArticle {
          uid
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

export default `
  query getBookWithRunStates(
    $bookUid: ID!
    $first: Int = 20
    $after: String = null
    $offset: Int = null
  ) {
    node(id: $bookUid) {
      ... on Book {
        __typename
        uid
        name
        book_type
        initialArticle {
          uid
        }
        runStates(first: $first, offset: $offset) {
          nodes {
            uid
            readyToFinish
            status
            createdAt
            completedAt
            currentArticle {
              uid
              hasAssignees
            }
          }
        }
      }
    }
  }
`;

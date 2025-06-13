export default `
  query getBookWithRunState(
    $bookUid: ID!
    $runStateUid: ID
  ) {
    node(id: $bookUid) {
      ... on Book {
        __typename
        uid
        name
        bookType
        initialArticle {
          uid
        }
        runState(uid: $runStateUid) {
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
`;

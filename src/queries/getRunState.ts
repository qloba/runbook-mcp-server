export default `
  query getRunState(
    $runStateUid: ID!
  ) {
    node(id: $runStateUid) {
      ... on RunState {
        __typename
        uid
        readyToFinish
        status
        createdAt
        completedAt
        currentArticle {
          uid
          name
        }
        processedArticles {
          article {
            uid
            name
          }
          properties {
            propId
            propName
            propCode
            propType
            value
          }
        }
        assignedArticle {
          uid
          name
          processed
        }
        book {
          uid
          name
          bookType
          initialArticle {
            uid
          } 
        }
      }
    }
  }
`;

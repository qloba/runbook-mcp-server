export default `
query GetAssignedRunStates(
    $status: RunStateStatus!
    $first: Int = 20
    $offset: Int = null
  ) {
    loginUser {
      assignedRunStates(status: $status, first: $first, offset: $offset) {
        nodes {
          uid
          readyToFinish
          status
          createdAt
          completedAt
          user {
            uid
            name
          }
          assignedArticle {
            uid
            name
            processed
          }
          book {
            uid
            name
            description
          }
        }
      }
    }
  }
`;

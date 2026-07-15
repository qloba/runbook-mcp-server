export default `
query GetAssignedRunStates(
    $status: RunStateStatus!
    $processed: Boolean
    $first: Int = 20
    $offset: Int = null
  ) {
    loginUser {
      assignedRunStates(
        status: $status
        processed: $processed
        first: $first
        offset: $offset
      ) {
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

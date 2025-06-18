export default `
mutation finishProcess($uid: ID!) {
  finishProcess(input: { uid: $uid }) {
    runState {
      uid
      readyToFinish
      status
      createdAt
      completedAt
    }
    finishMessage
    success
    errors {
      attribute
      message
    }
  }
}
`;

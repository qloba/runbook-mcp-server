export default `
mutation runProcess(
    $bookUid: ID!
    $propertyValues: [RunStatePropertyValueInput!]!
  ) {
  runProcess(
    input: {
      bookUid: $bookUid
      propertyValues: $propertyValues
    }
  ) {
    runState {
      uid
      readyToFinish
      status
      createdAt
      completedAt
    }
    nextArticle {
      uid
      name
      bodyMarkdown
      createdAt
      updatedAt
      properties {
        propId
        propName
        propCode
        propType
        required
        readOnly
      }
    }
    success
    errors {
      attribute
      message
      error
    }
  }
}
`;

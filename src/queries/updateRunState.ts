export default `
mutation updateRunState(
  $uid: ID!
  $articleUid: ID!
  $propertyValues: [RunStatePropertyValueInput!]!
) {
  updateRunState(
    input: {
      uid: $uid
      articleUid: $articleUid
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
      hasAssignees
      isAssigned
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

export default `
query getArticleWithProperties($articleUid: ID!) {
  node(id: $articleUid) {
    ... on Article {
      __typename
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
  }
}
`;

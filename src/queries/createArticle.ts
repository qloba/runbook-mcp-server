export default `
  mutation createArticle(
    $bookUid: ID!
    $name: String!
    $categoryUids: [ID!]
  ) {
    createArticle(
      input: {
        bookUid: $bookUid
        name: $name
        isPublished: true
        categoryUids: $categoryUids
      }
    ) {
      article {
        uid
      }
      success
      errors {
        attribute
        message
      }
    }
  }
`;

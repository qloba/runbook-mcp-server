export default `
  mutation createArticle(
    $bookUid: ID!
    $name: String!
    $bodyMarkdown: String
    $categoryUids: [ID!]
  ) {
    createArticle(
      input: {
        bookUid: $bookUid
        name: $name
        bodyMarkdown: $bodyMarkdown
        isPublished: true
        categoryUids: $categoryUids
      }
    ) {
      article {
        uid
        id
      }
      success
      errors {
        attribute
        message
      }
    }
  }
`;

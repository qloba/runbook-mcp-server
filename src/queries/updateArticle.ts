export default `
  mutation updateArticle(
    $uid: ID!
    $name: String
    $bodyMarkdown: String
    $categoryUids: [ID!]
  ) {
    updateArticle(
      input: {
        uid: $uid
        name: $name
        bodyMarkDown: $body
        isPublished: true
        categoryUids: $categoryUids
        createHistory: true
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

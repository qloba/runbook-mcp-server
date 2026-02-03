export default `
  fragment Article on Article {
    uid
    name
    slug
    id
    bodyMarkdown
    createdAt
    updatedAt
    allCategories {
      uid
      name
    }
    folder {
      uid
      name
    }
    book {
      uid
      name
      bookType
    }
  }
`;

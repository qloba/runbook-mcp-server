export default `
  fragment Book on Book {
    uid
    name
    pathname
    description
    bookType
    rootFolder {
      uid
    }
    initialArticle {
      uid
      name
    }
    workspace {
      uid
      name
      description
    }
  }
`;

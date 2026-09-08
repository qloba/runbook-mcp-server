import Book from './Book';
export default `
${Book}
query getBook(
  $bookUid: ID!
) {
  node(id: $bookUid) {
    ... on Book {
      __typename
      ...Book
    }
  }
}
`;

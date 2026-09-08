import Book from './Book';
export default `
${Book}
query getBookByPath($pathname: String!) {
  book(pathname: $pathname) {
    ...Book
  }
}
`;

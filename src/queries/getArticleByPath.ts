import Article from './Article';
export default `
${Article}
query getArticleByPath($pathname: String!, $articleId: ID!) {
  book(pathname: $pathname) {
    article(id: $articleId) {
      ...Article
    }
  }
}
`;

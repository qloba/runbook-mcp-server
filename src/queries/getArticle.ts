import Article from './Article';
export default `
${Article}
query getArticle($articleUid: ID!) {
  node(id: $articleUid) {
    ... on Article {
      __typename
      ...Article
    }
  }
}
`;

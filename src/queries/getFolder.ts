export default `
  fragment ContentNode on ContentNode {
    __typename
    ... on ContentFolderNode {
      nodeType
      uid
      name
    }
    ... on ContentArticleNode {
      nodeType
      uid
      name
    }
  }

  query getFolder($folderUid: ID!) {
    node(id: $folderUid) {
      ... on Folder {
        __typename
        uid
        name
        ancestors {
          uid
          name
        }
        children(first: 300) {
          nodes {
            ...ContentNode
          }
        }
      }
    }
  }
`;

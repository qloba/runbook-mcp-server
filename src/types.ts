export type RunState = {
  uid: string;
  readyToFinish: boolean;
  status: string;
  createdAt: string;
  completedAt: string | null;
  currentArticle: {
    uid: string;
  };
};

export type ArticleWithProperties = {
  uid: string;
  name: string;
  bodyMarkdown: string;
  hasAssignees: boolean;
  isAssigned: boolean;
  createdAt: string;
  updatedAt: string;
  properties: Array<{
    propId: string;
    propName: string;
    propCode: string;
    propType: string;
    required: boolean;
    readOnly: boolean;
  }>;
};

export type GetArticleWithPropertiesQuery = {
  node: {
    __typename: 'Article';
    uid: string;
  } & ArticleWithProperties;
};

export type RunProcessMutation = {
  runProcess: {
    runState: {
      uid: string;
      readyToFinish: boolean;
      status: string;
      createdAt: string;
      completedAt: string | null;
    };
    nextArticle: ArticleWithProperties;
    success: boolean;
    errors: Array<{
      attribute: string;
      message: string;
      error: string;
    }>;
  };
};

export type RunProcessMutationVariables = {
  bookUid: string;
  propertyValues: Array<{
    propId: string;
    value: string | null;
  }>;
};

export type FinishProcessMutation = {
  finishProcess: {
    runState: {
      uid: string;
      readyToFinish: boolean;
      status: string;
      createdAt: string;
      completedAt: string | null;
    };
    finishMessage: string | null;
    success: boolean;
    errors: Array<{
      attribute: string;
      message: string;
    }>;
  };
};

export type FinishProcessMutationVariables = {
  uid: string;
};

export type UpdateRunStateMutation = {
  updateRunState: {
    runState: {
      uid: string;
      readyToFinish: boolean;
      status: string;
      createdAt: string;
      completedAt: string | null;
    };
    nextArticle: ArticleWithProperties;
    success: boolean;
    errors: Array<{
      attribute: string;
      message: string;
      error: string;
    }>;
  };
};

export type UpdateRunStateMutationVariables = {
  uid: string;
  articleUid: string;
  propertyValues: Array<{
    propId: string;
    value: string | null;
  }>;
};

export type GetArticleQuery = {
  node: {
    __typename: 'Article';
    uid: string;
    name: string;
    slug: string;
    id: string;
    bodyMarkdown: string;
    createdAt: string;
    updatedAt: string;
    allCategories: Array<{
      uid: string;
      name: string;
    }>;
    folder: {
      uid: string;
      name: string;
    };
    book: {
      uid: string;
      name: string;
      bookType: string;
    };
  };
};

export type GetBookQuery = {
  node: {
    __typename: 'Book';
    uid: string;
    name: string;
    description: string | null;
    pathname: string | null;
    bookType: string;
    contentsLayout: string | null;
    hideFolders: boolean | null;
    sortOrder: string | null;
    isHidden: boolean | null;
    initialArticle: {
      uid: string;
    };
    workspace: {
      uid: string;
      name: string;
      description: string | null;
    };
  };
};

export type GetBookWithRunStatesQuery = {
  node: {
    __typename: 'Book';
    uid: string;
    name: string;
    bookType: string;
    initialArticle: {
      uid: string;
    };
    runStates: {
      nodes: Array<RunState>;
    };
  };
};

export type GetBookWithRunStateQuery = {
  node: {
    __typename: 'Book';
    uid: string;
    name: string;
    bookType: string;
    initialArticle: {
      uid: string;
    };
    runState: RunState | null;
  };
};

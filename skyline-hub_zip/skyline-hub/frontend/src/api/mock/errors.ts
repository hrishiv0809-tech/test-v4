export class MockError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.name = 'MockError';
  }
}

/**
 * Explicit `(… ) => never` annotations matter: TypeScript only treats a call as
 * terminating control flow when the called declaration carries an explicit type.
 */
export const badRequest: (detail: string) => never = (detail) => {
  throw new MockError(400, detail);
};

export const unauthorized: (detail?: string) => never = (detail = 'Not authenticated') => {
  throw new MockError(401, detail);
};

export const forbidden: (detail?: string) => never = (detail = 'Not enough permissions') => {
  throw new MockError(403, detail);
};

export const notFound: (detail?: string) => never = (detail = 'Not found') => {
  throw new MockError(404, detail);
};

export const conflict: (detail: string) => never = (detail) => {
  throw new MockError(409, detail);
};

export const gone: (detail: string) => never = (detail) => {
  throw new MockError(410, detail);
};

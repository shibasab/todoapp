export const createNotExhaustiveError = (target: string, unexpectedValue: never): Error => {
  const error = new Error(`Not exhaustive: ${target} (${String(unexpectedValue)})`);
  error.name = "NotExhaustiveError";
  return error;
};

export const assertNever = (unexpectedValue: never, target: string): never => {
  throw createNotExhaustiveError(target, unexpectedValue);
};

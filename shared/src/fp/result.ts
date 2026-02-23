export type Ok<T> = Readonly<{
  ok: true;
  data: T;
}>;

export type Err<E> = Readonly<{
  ok: false;
  error: E;
}>;

export type Result<T, E> = Ok<T> | Err<E>;
export type TaskResult<T, E> = Promise<Result<T, E>>;

export const ok = <T>(data: T): Result<T, never> => ({
  ok: true,
  data,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const map = <T, E, U>(result: Result<T, E>, mapper: (value: T) => U): Result<U, E> => {
  if (!result.ok) {
    return result;
  }

  return ok(mapper(result.data));
};

export const flatMap = <T, E, U, F>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, F>,
): Result<U, E | F> => {
  if (!result.ok) {
    return result;
  }

  return mapper(result.data);
};

export const mapError = <T, E, F>(result: Result<T, E>, mapper: (error: E) => F): Result<T, F> => {
  if (result.ok) {
    return result;
  }

  return err(mapper(result.error));
};

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: Readonly<{
    ok: (value: T) => U;
    err: (error: E) => U;
  }>,
): U => {
  if (result.ok) {
    return handlers.ok(result.data);
  }

  return handlers.err(result.error);
};

export const fromPromise = async <T, E>(
  promise: Promise<T>,
  mapRejected: (error: unknown) => E,
): TaskResult<T, E> => {
  try {
    return ok(await promise);
  } catch (errorValue) {
    return err(mapRejected(errorValue));
  }
};

export const all = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> => {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return result;
    }

    values.push(result.data);
  }

  return ok(values);
};

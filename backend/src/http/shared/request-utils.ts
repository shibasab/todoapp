import { err, ok, type Result } from "@todoapp/shared";

export type JsonResponder = Readonly<{
  json: (body: Record<string, unknown>, init?: number | ResponseInit) => Response;
}>;

export const readValidationField = (
  errorValue: Readonly<{
    issues: readonly Readonly<{ path: readonly unknown[] }>[];
  }>,
  fallbackField = "body",
): string => {
  const field = errorValue.issues[0]?.path[0];
  return typeof field === "string" ? field : fallbackField;
};

export const readJsonBody = async (
  context: Readonly<{
    req: Readonly<{
      json: () => Promise<unknown>;
    }>;
  }>,
): Promise<Result<unknown, "invalid_body">> => {
  try {
    return ok(await context.req.json());
  } catch {
    return err("invalid_body");
  }
};

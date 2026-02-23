import { Hono } from "hono";

export type TodoHttpRouteDependencies = Readonly<{
  // PR07b以降で usecase/ports を注入
}>;

export const createTodoHttpRoutes = (_dependencies: TodoHttpRouteDependencies): Hono => {
  const router = new Hono({ strict: false });

  // PR07b以降でエンドポイントを段階的に移行
  return router;
};

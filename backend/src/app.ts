import { Hono } from "hono";

export type HealthResponse = Readonly<{
  status: "ok";
}>;

const buildHealthResponse = (): HealthResponse => ({
  status: "ok",
});

export const createApp = (): Hono => {
  const app = new Hono();

  app.get("/health", (context) => {
    return context.json(buildHealthResponse());
  });

  return app;
};

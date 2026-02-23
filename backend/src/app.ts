import { Hono } from "hono";
import type { HealthResponse } from "@todoapp/shared";

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

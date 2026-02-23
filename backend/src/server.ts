import { createApp } from "./app";

export type ServerConfig = Readonly<{
  port: number;
}>;

const readPort = (rawPort: string | undefined): number => {
  if (rawPort == null || rawPort === "") {
    return 8000;
  }

  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return 8000;
  }

  return parsed;
};

export const createServerConfig = (): ServerConfig => ({
  port: readPort(Bun.env.PORT),
});

export const startServer = (config: ServerConfig = createServerConfig()) => {
  const app = createApp();

  return Bun.serve({
    port: config.port,
    fetch: app.fetch,
  });
};

if (import.meta.main) {
  startServer();
}

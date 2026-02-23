export type PublicUser = Readonly<{
  id: number;
  username: string;
  email: string;
}>;

export type AuthTokenResponse = Readonly<{
  user: PublicUser;
  token: string;
}>;

export type RegisterInput = Readonly<{
  username: string;
  email: string;
  password: string;
}>;

export type LoginInput = Readonly<{
  username: string;
  password: string;
}>;

export type AuthConfig = Readonly<{
  jwtSecret: string;
  jwtAccessTokenExpireMinutes: number;
}>;

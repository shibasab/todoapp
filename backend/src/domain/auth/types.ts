import type { User } from "@todoapp/shared";

export type AuthConfig = Readonly<{
  jwtSecret: string;
  jwtAccessTokenExpireMinutes: number;
}>;

export type AuthValidationErrorReason = "invalid_format" | "required";

export type AuthValidationError = Readonly<{
  field: string;
  reason: AuthValidationErrorReason;
}>;

export type AuthUserRecord = Readonly<{
  id: number;
  username: string;
  email: string;
  hashedPassword: string;
  isActive: boolean;
}>;

export type PublicUser = User;

export type AuthTokenResponse = Readonly<{
  user: PublicUser;
  token: string;
}>;

export const toPublicUser = (
  user: Readonly<Pick<AuthUserRecord, "id" | "username" | "email">>,
): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
});

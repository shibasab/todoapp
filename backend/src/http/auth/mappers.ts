import type { AuthResponse, User } from "@todoapp/shared";
import type { AuthTokenResponse, PublicUser } from "../../domain/auth/types";

export const toUserDto = (user: PublicUser): User => ({
  id: user.id,
  username: user.username,
  email: user.email,
});

export const toAuthResponseDto = (response: AuthTokenResponse): AuthResponse => ({
  user: toUserDto(response.user),
  token: response.token,
});

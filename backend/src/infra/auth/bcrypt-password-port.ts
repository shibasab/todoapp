import { compare, hash } from "bcryptjs";
import type { PasswordPort } from "../../ports/password-port";

export const bcryptPasswordPort: PasswordPort = {
  hash: async (rawPassword) => hash(rawPassword, 10),
  verify: async (rawPassword, hashedPassword) => compare(rawPassword, hashedPassword),
};

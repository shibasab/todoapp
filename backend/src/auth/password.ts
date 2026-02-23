import { compare, hash } from "bcryptjs";

export const hashPassword = async (password: string): Promise<string> => hash(password, 10);

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> =>
  compare(password, hashedPassword);

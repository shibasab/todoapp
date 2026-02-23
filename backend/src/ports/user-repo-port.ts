export type UserRecord = Readonly<{
  id: number;
  username: string;
  email: string;
  isActive: boolean;
}>;

export type UserRepoPort = Readonly<{
  findById: (id: number) => Promise<UserRecord | null>;
}>;

export type AppRole = "ADMIN" | "MODERATOR" | "USER";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
}

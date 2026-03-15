import { apiRequest } from "./api";

export type CurrentUser = {
  id: string;
  username: string;
  verified?: boolean;
  email?: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
} | null;

export function getCurrentUser() {
  return apiRequest<CurrentUser>("auth/me");
}

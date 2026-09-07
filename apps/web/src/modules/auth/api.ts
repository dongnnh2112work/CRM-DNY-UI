import { apiRequest } from "@/lib/http/client";
import { getApiBaseUrl } from "@/lib/http/tokens";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  permissions: string[];
  roleCodes: string[];
};

export type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number;
  tokenType: string;
  user: AuthUser;
};

export type SignupResponse =
  | SessionResponse
  | {
      requiresEmailConfirmation: true;
      message: string;
      user: AuthUser;
    };

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<SessionResponse>("/auth/login", {
      method: "POST",
      skipAuth: true,
      skipRefresh: true,
      body: JSON.stringify({ email, password }),
    });
  },

  signup(input: { email: string; password: string; displayName: string }) {
    return apiRequest<SignupResponse>("/auth/signup", {
      method: "POST",
      skipAuth: true,
      skipRefresh: true,
      body: JSON.stringify(input),
    });
  },

  me() {
    return apiRequest<AuthUser>("/auth/me");
  },

  refresh(refreshToken: string) {
    return apiRequest<SessionResponse>("/auth/refresh", {
      method: "POST",
      skipAuth: true,
      skipRefresh: true,
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout() {
    return apiRequest<{ success: true }>("/auth/logout", { method: "POST", skipRefresh: true });
  },

  changePassword(newPassword: string) {
    return apiRequest<{ success: true }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
  },

  googleOAuthUrl(redirectTo: string) {
    const q = new URLSearchParams({ redirectTo });
    return `${getApiBaseUrl()}/auth/oauth/google?${q.toString()}`;
  },
};

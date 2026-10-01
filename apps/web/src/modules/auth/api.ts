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

  /**
   * Start Nest Google OAuth. Preflights redirect allowlist so localhost
   * gets a clear error instead of a raw 400 JSON page when BE only
   * allows the Vercel origin.
   */
  async loginWithGoogle(): Promise<void> {
    const API = getApiBaseUrl();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const url = `${API}/auth/oauth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
    try {
      const preflight = await fetch(url, { method: "GET", redirect: "manual", credentials: "include" });
      if (preflight.status === 400) {
        let detail = "";
        try {
          const body = (await preflight.json()) as { error?: string[] | string };
          detail = Array.isArray(body.error) ? body.error.join(" ") : String(body.error ?? "");
        } catch {
          /* ignore */
        }
        if (/redirectTo not allowed|OAUTH_REDIRECT_ALLOW_PREFIX/i.test(detail)) {
          throw new Error("OAUTH_REDIRECT_NOT_ALLOWED");
        }
        throw new Error(detail || "OAUTH_START_FAILED");
      }
      // Opaque/0 or 3xx means browser may follow; navigate for real cookie + 302.
    } catch (err) {
      if (err instanceof Error && err.message === "OAUTH_REDIRECT_NOT_ALLOWED") throw err;
      if (err instanceof Error && err.message === "OAUTH_START_FAILED") throw err;
      // Network/CORS quirks — still attempt full navigation.
    }
    window.location.href = url;
  },
};

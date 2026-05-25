import { jwtDecode } from "jwt-decode";
export type AuthPayload = {
  userId: string;
  email: string;
  exp?: number;
  iat?: number;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function getAuthPayload(): AuthPayload | null {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const payload = jwtDecode<AuthPayload>(token);
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("access_token");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
}

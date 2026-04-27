const AUTH_TOKEN_KEY = "budget_hub_auth_token";

export function getAuthToken(): string | null {
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    return token && token.trim() ? token : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null | undefined): void {
  try {
    if (token && token.trim()) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
      return;
    }
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage failures (private mode/storage blocked).
  }
}

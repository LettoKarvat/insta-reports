interface HumanTokenData {
  token: string;
  expiresAt: number;
}

export function saveHumanToken(token: string, expiresIn: number): void {
  const expiresAt = Date.now() + (expiresIn * 1000);
  const data: HumanTokenData = { token, expiresAt };
  sessionStorage.setItem('human_token_data', JSON.stringify(data));
}

export function getValidHumanToken(): string | null {
  try {
    const data = sessionStorage.getItem('human_token_data');
    if (!data) return null;

    const tokenData: HumanTokenData = JSON.parse(data);
    
    if (Date.now() > tokenData.expiresAt) {
      sessionStorage.removeItem('human_token_data');
      return null;
    }

    return tokenData.token;
  } catch {
    sessionStorage.removeItem('human_token_data');
    return null;
  }
}

export function clearHumanToken(): void {
  sessionStorage.removeItem('human_token_data');
}

export function saveAuthData(accessToken: string, user: any): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('user_data', JSON.stringify(user));
}

export function getAuthData(): { accessToken: string | null; user: any | null } {
  try {
    const accessToken = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    const user = userData ? JSON.parse(userData) : null;
    return { accessToken, user };
  } catch {
    return { accessToken: null, user: null };
  }
}

export function clearAuthData(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_data');
}
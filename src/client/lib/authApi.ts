export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface AuthUser {
  id: string
  email: string
}

export interface AuthResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  id?: string
  email?: string
  error?: string
  error_description?: string
  msg?: string
}

export async function signUp(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, grant_type: 'password' }),
  })
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/token/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return res.json()
}

export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function updateUserPassword(accessToken: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/user', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password }),
  })
  return res.json()
}

export async function logout(accessToken: string): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
}

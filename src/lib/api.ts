import type { GraphPayload, PersonNode, PersonRelation } from '../types'

const TOKEN_KEY = 'neural_admin_token'

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const fallback = 'Ошибка запроса'
    const text = await response.text()
    if (!text) {
      throw new Error(fallback)
    }
    try {
      const parsed = JSON.parse(text) as { message?: string }
      throw new Error(parsed.message || fallback)
    } catch {
      throw new Error(text || fallback)
    }
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export async function fetchGraph(): Promise<GraphPayload> {
  return request<GraphPayload>('/api/graph')
}

export async function login(password: string): Promise<void> {
  const result = await request<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  setAuthToken(result.token)
}

export async function addPerson(person: PersonNode): Promise<PersonNode> {
  return request<PersonNode>('/api/people', {
    method: 'POST',
    body: JSON.stringify(person),
  })
}

export async function updatePerson(id: string, updates: Partial<PersonNode>): Promise<PersonNode> {
  return request<PersonNode>(`/api/people/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deletePerson(id: string): Promise<void> {
  return request<void>(`/api/people/${id}`, { method: 'DELETE' })
}

export async function addRelation(relation: PersonRelation): Promise<PersonRelation> {
  return request<PersonRelation>('/api/relations', {
    method: 'POST',
    body: JSON.stringify(relation),
  })
}

export async function deleteRelation(id: string): Promise<void> {
  return request<void>(`/api/relations/${id}`, { method: 'DELETE' })
}

export async function importGraph(payload: GraphPayload): Promise<void> {
  return request<void>('/api/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

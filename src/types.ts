export type RelationType =
  | 'colleague'
  | 'friend'
  | 'manager'
  | 'client'
  | 'partner'

export interface PersonNode {
  id: string
  name: string
  role: string
  description: string
  company: string
  tags: string[]
  importance: number
  createdAt: string
}

export interface PersonRelation {
  id: string
  from_id: string
  to_id: string
  type: RelationType
  strength: number
}

export interface GraphPayload {
  people: PersonNode[]
  relations: PersonRelation[]
}

export interface AuthState {
  adminUnlocked: boolean
}

import { create } from 'zustand'
import * as api from '../lib/api'
import type { GraphPayload, PersonNode, PersonRelation, RelationType } from '../types'

const relationTypes: RelationType[] = ['colleague', 'friend', 'manager', 'client', 'partner']

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

interface GraphStore {
  people: PersonNode[]
  relations: PersonRelation[]
  loading: boolean
  adminUnlocked: boolean
  error: string
  init: () => Promise<void>
  loginAsAdmin: (password: string) => Promise<void>
  logout: () => void
  addPerson: (person: Omit<PersonNode, 'id' | 'createdAt'>) => Promise<void>
  updatePerson: (id: string, updates: Partial<Omit<PersonNode, 'id' | 'createdAt'>>) => Promise<void>
  removePerson: (id: string) => Promise<void>
  addRelation: (relation: Omit<PersonRelation, 'id'>) => Promise<void>
  removeRelation: (id: string) => Promise<void>
  importGraph: (payload: GraphPayload) => Promise<void>
  clearError: () => void
}

export const useGraphStore = create<GraphStore>()((set, get) => ({
  people: [],
  relations: [],
  loading: false,
  adminUnlocked: Boolean(api.getAuthToken()),
  error: '',
  clearError: () => set({ error: '' }),
  init: async () => {
    set({ loading: true, error: '' })
    try {
      const data = await api.fetchGraph()
      set({ people: data.people, relations: data.relations })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Ошибка загрузки графа.' })
    } finally {
      set({ loading: false })
    }
  },
  loginAsAdmin: async (password) => {
    set({ error: '' })
    try {
      await api.login(password)
      set({ adminUnlocked: true })
      await get().init()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Ошибка авторизации.' })
      throw error
    }
  },
  logout: () => {
    api.clearAuthToken()
    set({ adminUnlocked: false, people: [], relations: [] })
  },
  addPerson: async (person) => {
    const payload: PersonNode = {
      ...person,
      id: makeId('person'),
      createdAt: new Date().toISOString(),
    }
    await api.addPerson(payload)
    await get().init()
  },
  updatePerson: async (id, updates) => {
    await api.updatePerson(id, updates)
    await get().init()
  },
  removePerson: async (id) => {
    await api.deletePerson(id)
    await get().init()
  },
  addRelation: async (relation) => {
    if (!relationTypes.includes(relation.type)) return
    const payload: PersonRelation = { ...relation, id: makeId('rel') }
    await api.addRelation(payload)
    await get().init()
  },
  removeRelation: async (id) => {
    await api.deleteRelation(id)
    await get().init()
  },
  importGraph: async (payload) => {
    await api.importGraph(payload)
    await get().init()
  },
}))

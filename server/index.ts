import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import type { GraphPayload, PersonNode, PersonRelation, RelationType } from '../src/types'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 8787)
const maxLoginAttempts = 5
const lockDurationMs = 2 * 60 * 60 * 1000 // 2 часа

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PASSWORD', 'JWT_SECRET'] as const

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`)
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

const allowedRelationTypes: RelationType[] = ['colleague', 'friend', 'manager', 'client', 'partner']

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))

type AuthRequest = express.Request & {
  user?: {
    role: string
  }
}

type LoginAttemptState = {
  attempts: number
  lockedUntil: number
}

const loginAttempts = new Map<string, LoginAttemptState>()

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? 'unknown'
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function clearExpiredAttempts(now: number): void {
  for (const [ip, state] of loginAttempts.entries()) {
    if (state.lockedUntil > 0 && state.lockedUntil <= now) {
      loginAttempts.delete(ip)
    }
  }
}

function requireAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authorization = req.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''

  if (!token) {
    res.status(401).json({ message: 'Требуется авторизация.' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { role: string }
    if (payload.role !== 'admin') {
      res.status(403).json({ message: 'Недостаточно прав.' })
      return
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Недействительный токен.' })
  }
}

function isPerson(value: unknown): value is Omit<PersonNode, 'createdAt'> & { createdAt?: string } {
  if (!value || typeof value !== 'object') return false
  const person = value as Record<string, unknown>
  return (
    typeof person.id === 'string' &&
    typeof person.name === 'string' &&
    typeof person.role === 'string' &&
    typeof person.description === 'string' &&
    typeof person.company === 'string' &&
    Array.isArray(person.tags) &&
    typeof person.importance === 'number'
  )
}

function isRelation(value: unknown): value is PersonRelation {
  if (!value || typeof value !== 'object') return false
  const relation = value as Record<string, unknown>
  return (
    typeof relation.id === 'string' &&
    typeof relation.from_id === 'string' &&
    typeof relation.to_id === 'string' &&
    typeof relation.strength === 'number' &&
    typeof relation.type === 'string' &&
    allowedRelationTypes.includes(relation.type as RelationType)
  )
}

app.get('/api/graph', requireAdmin, async (_req, res) => {
  const [peopleResult, relationsResult] = await Promise.all([
    supabase.from('people').select('*').order('createdAt', { ascending: false }),
    supabase.from('relations').select('*'),
  ])

  if (peopleResult.error || relationsResult.error) {
    res.status(500).json({
      message: 'Ошибка загрузки графа.',
      details: peopleResult.error?.message ?? relationsResult.error?.message,
    })
    return
  }

  res.json({
    people: peopleResult.data ?? [],
    relations: relationsResult.data ?? [],
  } as GraphPayload)
})

app.post('/api/auth/login', (req, res) => {
  const now = Date.now()
  clearExpiredAttempts(now)
  const ip = getClientIp(req)
  const state = loginAttempts.get(ip) ?? { attempts: 0, lockedUntil: 0 }

  if (state.lockedUntil > now) {
    const minutesLeft = Math.ceil((state.lockedUntil - now) / 60000)
    res.status(429).json({
      message: `Слишком много попыток. Повторите через ${minutesLeft} мин.`,
    })
    return
  }

  const password = String(req.body?.password ?? '')
  if (password !== process.env.ADMIN_PASSWORD) {
    state.attempts += 1
    if (state.attempts >= maxLoginAttempts) {
      state.lockedUntil = now + lockDurationMs
      loginAttempts.set(ip, state)
      res.status(429).json({
        message: 'Превышен лимит попыток. Доступ заблокирован на 2 часа.',
      })
      return
    }
    loginAttempts.set(ip, state)
    res.status(401).json({ message: 'Неверный пароль.' })
    return
  }

  loginAttempts.delete(ip)

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET as string, {
    expiresIn: '8h',
  })
  res.json({ token })
})

app.post('/api/people', requireAdmin, async (req, res) => {
  const person = req.body
  if (!isPerson(person)) {
    res.status(400).json({ message: 'Неверный формат данных человека.' })
    return
  }
  const row = { ...person, createdAt: person.createdAt ?? new Date().toISOString() }
  const result = await supabase.from('people').insert(row).select('*').single()
  if (result.error) {
    res.status(500).json({ message: 'Ошибка создания человека.', details: result.error.message })
    return
  }
  res.status(201).json(result.data)
})

app.patch('/api/people/:id', requireAdmin, async (req, res) => {
  const id = req.params.id
  const updates = req.body as Partial<PersonNode>
  const result = await supabase.from('people').update(updates).eq('id', id).select('*').single()
  if (result.error) {
    res.status(500).json({ message: 'Ошибка обновления человека.', details: result.error.message })
    return
  }
  res.json(result.data)
})

app.delete('/api/people/:id', requireAdmin, async (req, res) => {
  const id = req.params.id
  const result = await supabase.from('people').delete().eq('id', id)
  if (result.error) {
    res.status(500).json({ message: 'Ошибка удаления человека.', details: result.error.message })
    return
  }
  res.status(204).send()
})

app.post('/api/relations', requireAdmin, async (req, res) => {
  const relation = req.body
  if (!isRelation(relation)) {
    res.status(400).json({ message: 'Неверный формат данных связи.' })
    return
  }
  const result = await supabase.from('relations').insert(relation).select('*').single()
  if (result.error) {
    res.status(500).json({ message: 'Ошибка создания связи.', details: result.error.message })
    return
  }
  res.status(201).json(result.data)
})

app.delete('/api/relations/:id', requireAdmin, async (req, res) => {
  const id = req.params.id
  const result = await supabase.from('relations').delete().eq('id', id)
  if (result.error) {
    res.status(500).json({ message: 'Ошибка удаления связи.', details: result.error.message })
    return
  }
  res.status(204).send()
})

app.post('/api/import', requireAdmin, async (req, res) => {
  const payload = req.body as GraphPayload
  if (!Array.isArray(payload.people) || !Array.isArray(payload.relations)) {
    res.status(400).json({ message: 'Неверный формат импортируемого JSON.' })
    return
  }

  if (!payload.people.every(isPerson) || !payload.relations.every(isRelation)) {
    res.status(400).json({ message: 'JSON содержит некорректные объекты.' })
    return
  }

  const removeRelations = await supabase.from('relations').delete().not('id', 'is', null)
  if (removeRelations.error) {
    res.status(500).json({ message: 'Не удалось очистить связи.', details: removeRelations.error.message })
    return
  }
  const removePeople = await supabase.from('people').delete().not('id', 'is', null)
  if (removePeople.error) {
    res.status(500).json({ message: 'Не удалось очистить людей.', details: removePeople.error.message })
    return
  }

  if (payload.people.length > 0) {
    const insertPeople = await supabase.from('people').insert(payload.people)
    if (insertPeople.error) {
      res.status(500).json({ message: 'Не удалось вставить людей.', details: insertPeople.error.message })
      return
    }
  }
  if (payload.relations.length > 0) {
    const insertRelations = await supabase.from('relations').insert(payload.relations)
    if (insertRelations.error) {
      res.status(500).json({ message: 'Не удалось вставить связи.', details: insertRelations.error.message })
      return
    }
  }

  res.status(200).json({ message: 'Импорт завершен.' })
})

app.listen(port, () => {
  console.log(`API сервер запущен: http://localhost:${port}`)
})

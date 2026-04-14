import ForceGraph2D from 'react-force-graph-2d'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useGraphStore } from './store/graphStore'
import type { GraphPayload, PersonNode, RelationType } from './types'

type GraphNode = PersonNode & { val: number }
type GraphLink = {
  id: string
  source: string
  target: string
  type: RelationType
  strength: number
}

const relationLabels: Record<RelationType, string> = {
  colleague: 'Коллега',
  friend: 'Друг',
  manager: 'Руководитель',
  client: 'Клиент',
  partner: 'Партнер',
}

const relationOptions = Object.entries(relationLabels) as Array<[RelationType, string]>

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    people,
    relations,
    loading,
    adminUnlocked,
    error,
    init,
    loginAsAdmin,
    logout,
    clearError,
    addPerson,
    updatePerson,
    removePerson,
    addRelation,
    removeRelation,
    importGraph,
  } = useGraphStore()

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [adminInput, setAdminInput] = useState('')
  const [authHint, setAuthHint] = useState('')

  const [personForm, setPersonForm] = useState({
    name: '',
    role: '',
    description: '',
    company: '',
    tags: '',
    importance: 6,
  })

  const [relationForm, setRelationForm] = useState({
    from_id: '',
    to_id: '',
    type: 'colleague' as RelationType,
    strength: 5,
  })

  useEffect(() => {
    if (adminUnlocked) {
      void init()
    }
  }, [adminUnlocked, init])

  const allTags = useMemo(
    () => Array.from(new Set(people.flatMap((person) => person.tags))).sort(),
    [people],
  )

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      const q = search.toLowerCase()
      const matchesSearch =
        person.name.toLowerCase().includes(q) ||
        person.role.toLowerCase().includes(q) ||
        person.company.toLowerCase().includes(q)
      const matchesTag = tagFilter === 'all' || person.tags.includes(tagFilter)
      return matchesSearch && matchesTag
    })
  }, [people, search, tagFilter])

  const allowedIds = useMemo(() => new Set(filteredPeople.map((person) => person.id)), [filteredPeople])

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = filteredPeople.map((person) => ({ ...person, val: person.importance * 1.8 }))
    const links: GraphLink[] = relations
      .filter((relation) => allowedIds.has(relation.from_id) && allowedIds.has(relation.to_id))
      .map((relation) => ({
        id: relation.id,
        source: relation.from_id,
        target: relation.to_id,
        type: relation.type,
        strength: relation.strength,
      }))
    return { nodes, links }
  }, [filteredPeople, relations, allowedIds])

  const selectedPerson = selectedId ? people.find((person) => person.id === selectedId) ?? null : null
  const isReadOnly = !adminUnlocked

  const highlightedLinks = useMemo(
    () =>
      new Set(
        relations
          .filter((relation) => relation.from_id === hoveredId || relation.to_id === hoveredId)
          .map((relation) => relation.id),
      ),
    [relations, hoveredId],
  )

  const handleAdminUnlock = () => {
    void loginAsAdmin(adminInput)
      .then(() => {
        setAuthHint('')
        setAdminInput('')
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Ошибка авторизации.'
        setAuthHint(message)
      })
  }

  const handleAddPerson = () => {
    if (!personForm.name.trim() || isReadOnly) return
    void addPerson({
      name: personForm.name.trim(),
      role: personForm.role.trim(),
      description: personForm.description.trim(),
      company: personForm.company.trim(),
      tags: personForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      importance: personForm.importance,
    })
    setPersonForm({ name: '', role: '', description: '', company: '', tags: '', importance: 6 })
  }

  const handleAddRelation = () => {
    if (isReadOnly || !relationForm.from_id || !relationForm.to_id) return
    void addRelation(relationForm)
  }

  const exportJson = () => {
    const payload: GraphPayload = { people, relations }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'neural-people-graph.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    const payload = JSON.parse(text) as GraphPayload
    if (!payload.people || !payload.relations) return
    await importGraph(payload)
  }

  const handleDeleteSelected = () => {
    if (!selectedPerson || isReadOnly) return
    void removePerson(selectedPerson.id)
    setSelectedId(null)
  }

  if (!adminUnlocked) {
    return (
      <div className="app-shell">
        <div className="scanline-overlay" />
        <main className="graph-zone" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="person-card" style={{ position: 'static', width: 420, maxWidth: '92vw' }}>
            <h3>Доступ ограничен</h3>
            <p className="muted">Для просмотра и управления графом требуется вход администратора.</p>
            <input
              type="password"
              placeholder="Пароль администратора"
              value={adminInput}
              onChange={(event) => setAdminInput(event.target.value)}
            />
            <button onClick={handleAdminUnlock}>Войти</button>
            {(authHint || error) && <p className="muted">{authHint || error}</p>}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="scanline-overlay" />
      <aside className="panel">
        <h1>Нейрограф Людей</h1>
        <div className="card">
          <h2>Сессия администратора</h2>
          <button onClick={logout}>Выйти</button>
        </div>

        <div className="card">
          <h2>Поиск и фильтрация</h2>
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Поиск по имени, роли, компании"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">Все теги</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          <h2>Добавить человека</h2>
          <input placeholder="Имя" value={personForm.name} onChange={(event) => setPersonForm((prev) => ({ ...prev, name: event.target.value }))} />
          <input placeholder="Должность" value={personForm.role} onChange={(event) => setPersonForm((prev) => ({ ...prev, role: event.target.value }))} />
          <input placeholder="Компания" value={personForm.company} onChange={(event) => setPersonForm((prev) => ({ ...prev, company: event.target.value }))} />
          <textarea placeholder="Описание" value={personForm.description} onChange={(event) => setPersonForm((prev) => ({ ...prev, description: event.target.value }))} />
          <input placeholder="Теги (через запятую)" value={personForm.tags} onChange={(event) => setPersonForm((prev) => ({ ...prev, tags: event.target.value }))} />
          <label>
            Уровень важности: {personForm.importance}
            <input
              type="range"
              min={1}
              max={10}
              value={personForm.importance}
              onChange={(event) =>
                setPersonForm((prev) => ({ ...prev, importance: Number(event.target.value) }))
              }
            />
          </label>
          <button disabled={isReadOnly} onClick={handleAddPerson}>
            Добавить человека
          </button>
        </div>

        <div className="card">
          <h2>Добавить связь</h2>
          <select value={relationForm.from_id} onChange={(event) => setRelationForm((prev) => ({ ...prev, from_id: event.target.value }))}>
            <option value="">От кого</option>
            {people.map((person) => (
              <option key={`from_${person.id}`} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select value={relationForm.to_id} onChange={(event) => setRelationForm((prev) => ({ ...prev, to_id: event.target.value }))}>
            <option value="">Кому</option>
            {people.map((person) => (
              <option key={`to_${person.id}`} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select value={relationForm.type} onChange={(event) => setRelationForm((prev) => ({ ...prev, type: event.target.value as RelationType }))}>
            {relationOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label>
            Сила связи: {relationForm.strength}
            <input
              type="range"
              min={1}
              max={10}
              value={relationForm.strength}
              onChange={(event) =>
                setRelationForm((prev) => ({ ...prev, strength: Number(event.target.value) }))
              }
            />
          </label>
          <button disabled={isReadOnly} onClick={handleAddRelation}>
            Добавить связь
          </button>
        </div>

        <div className="card inline-actions">
          <button onClick={exportJson}>Экспорт JSON</button>
          <button disabled={isReadOnly} onClick={() => fileInputRef.current?.click()}>
            Импорт JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            hidden
            onChange={(event) => {
              void importJson(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </div>
      </aside>

      <main className="graph-zone">
        <div className="grid-overlay" />
        <ForceGraph2D
          graphData={graphData}
          cooldownTicks={Infinity}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.23}
          backgroundColor="#f7f7f8"
          linkDirectionalParticles={(link) => Math.max(1, Math.floor(link.strength / 3))}
          linkDirectionalParticleWidth={1.1}
          linkDirectionalParticleColor={() => 'rgba(208, 227, 255, 0.95)'}
          linkColor={(link) =>
            highlightedLinks.has(link.id) ? 'rgba(86, 120, 210, 0.85)' : 'rgba(44, 69, 148, 0.45)'
          }
          linkWidth={(link) => (highlightedLinks.has(link.id) ? 1.8 : Math.max(0.7, link.strength * 0.2))}
          onNodeHover={(node) => setHoveredId(node?.id ?? null)}
          onNodeClick={(node) => setSelectedId(node.id)}
          onNodeDragEnd={(node) => {
            node.fx = node.x
            node.fy = node.y
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const radius = 4 + node.importance * 1.2
            const highlighted = hoveredId === node.id || selectedId === node.id
            const gradient = ctx.createRadialGradient(
              node.x ?? 0,
              node.y ?? 0,
              1,
              node.x ?? 0,
              node.y ?? 0,
              radius,
            )
            gradient.addColorStop(0, highlighted ? '#ffffff' : '#eef5ff')
            gradient.addColorStop(0.4, highlighted ? '#d9e8ff' : '#d4e2ff')
            gradient.addColorStop(1, highlighted ? '#6f8edb' : '#88a2df')
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false)
            ctx.fillStyle = gradient
            ctx.shadowColor = highlighted ? 'rgba(90, 128, 220, 0.95)' : 'rgba(93, 129, 207, 0.75)'
            ctx.shadowBlur = highlighted ? 26 : 14
            ctx.fill()
            ctx.shadowBlur = 0
            ctx.lineWidth = highlighted ? 2.2 : 1.6
            ctx.strokeStyle = highlighted ? 'rgba(255,255,255,0.95)' : 'rgba(221,232,255,0.88)'
            ctx.stroke()

            const label = node.name
            const fontSize = Math.max(10, 14 / globalScale)
            ctx.font = `${fontSize}px Inter, sans-serif`
            ctx.fillStyle = '#273963'
            ctx.shadowColor = 'rgba(245,250,255,0.95)'
            ctx.shadowBlur = 4
            ctx.fillText(label, (node.x ?? 0) + radius + 4, (node.y ?? 0) + 4)
            ctx.shadowBlur = 0
          }}
        />

        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              className="person-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <h3>{selectedPerson.name}</h3>
              <p>{selectedPerson.role}</p>
              <p>{selectedPerson.company}</p>
              <p className="muted">{selectedPerson.description}</p>
              <div className="chips">
                {selectedPerson.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="inline-actions">
                <button
                  disabled={isReadOnly}
                  onClick={() =>
                    void updatePerson(selectedPerson.id, {
                      importance: Math.min(10, selectedPerson.importance + 1),
                    })
                  }
                >
                  Повысить важность
                </button>
                <button disabled={isReadOnly} onClick={handleDeleteSelected}>
                  Удалить человека
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relation-strip">
          {relations.slice(0, 6).map((relation) => (
            <button key={relation.id} disabled={isReadOnly} onClick={() => void removeRelation(relation.id)}>
              {relationLabels[relation.type]} · {relation.strength}
            </button>
          ))}
        </div>
        {(loading || error) && (
          <div className="status-card">
            {loading && <p>Загрузка графа...</p>}
            {error && (
              <>
                <p>{error}</p>
                <button onClick={clearError}>Скрыть</button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App

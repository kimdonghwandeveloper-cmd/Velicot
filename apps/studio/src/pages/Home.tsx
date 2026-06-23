import React, { useRef, useState } from 'react'
import { deserializeModel, type CanvasModel } from '@velicot/editor'
import { NewFileDialog } from '../components/NewFileDialog'

export interface RecentFile {
  filename: string
  timestamp: number
  modelJson: string
}

export function saveRecent(filename: string, modelJson: string): void {
  try {
    const list: RecentFile[] = loadRecents().filter((r) => r.filename !== filename)
    list.unshift({ filename, timestamp: Date.now(), modelJson })
    localStorage.setItem('velicot-recents', JSON.stringify(list.slice(0, 20)))
  } catch {}
}

function loadRecents(): RecentFile[] {
  try {
    return JSON.parse(localStorage.getItem('velicot-recents') ?? '[]')
  } catch {
    return []
  }
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} minutes ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} hours ago`
  return `${Math.floor(d / 86_400_000)} days ago`
}

interface Props {
  onOpenEditor: (model: CanvasModel, filename: string) => void
}

export function Home({ onOpenEditor }: Props) {
  const [showNewFile, setShowNewFile] = useState(false)
  const [recents, setRecents] = useState<RecentFile[]>(loadRecents)
  const [activeNav, setActiveNav] = useState<string>('Home')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredRecents = recents.filter((f) =>
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const displayedRecents = showAll ? filteredRecents : filteredRecents.slice(0, 6)

  const handleNavChange = (label: string) => {
    setActiveNav(label)
    setSearchQuery('')
    setShowAll(false)
  }

  const handleCreate = (model: CanvasModel, filename: string) => {
    setShowNewFile(false)
    onOpenEditor(model, filename)
  }

  const handleOpenFile = (file: RecentFile) => {
    try {
      const model = deserializeModel(file.modelJson)
      onOpenEditor(model, file.filename)
    } catch {
      setLoadError(`Failed to load "${file.filename}"`)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        const model = deserializeModel(json)
        saveRecent(f.name, json)
        setRecents(loadRecents())
        onOpenEditor(model, f.name)
      } catch {
        setLoadError(`"${f.name}" is not a valid .kfm.json file`)
      }
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <DiamondLogo />
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Personal Files</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-elevated)', borderRadius: 20,
            padding: '4px 10px 4px 6px', border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>D</div>
            <span style={{ color: 'var(--text-1)', fontSize: 12 }}>Donghwan Kim</span>
            <span style={{ color: 'var(--text-3)', fontSize: 10 }}>▾</span>
          </div>
          <IconBtn title="Notifications">🔔</IconBtn>
          <IconBtn title="Back">‹</IconBtn>
          <IconBtn title="Forward">›</IconBtn>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '2px 8px', fontSize: 10, letterSpacing: 1,
            color: 'var(--text-3)',
          }}>
            ALPHA 0.1.0
          </span>
          {/* Hidden file input for importing .kfm.json */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.kfm.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={outlineBtnStyle}
            title="Open existing .kfm.json file"
          >
            Open File
          </button>
          <button
            onClick={() => setShowNewFile(true)}
            style={primaryBtnStyle}
          >
            New File
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          padding: '12px 0', gap: 2, flexShrink: 0,
          overflowY: 'auto',
        }}>
          {[
            { icon: '⌂', label: 'Home' },
            { icon: '⊙', label: 'Search' },
            { icon: '◷', label: 'Recents' },
            { icon: '⊕', label: 'Shared with me' },
          ].map(({ icon, label }) => (
            <NavItem
              key={label}
              icon={icon} label={label}
              active={activeNav === label}
              onClick={() => handleNavChange(label)}
            />
          ))}

          <div style={{ margin: '12px 16px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>S</div>
              <span style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 500 }}>SVG Studio</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>▾</span>
            </div>
          </div>

          <NavItem icon="⊕" label="New Project" onClick={() => {}} indent />
          <NavItem icon="📁" label="Personal Files" active={true} onClick={() => {}} indent />
          <NavItem icon="👥" label="Shared Projects" onClick={() => {}} indent />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {loadError && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{loadError}</span>
              <button onClick={() => setLoadError(null)} style={{ background: 'none', color: '#f87171', fontSize: 14 }}>✕</button>
            </div>
          )}

          {/* Search view */}
          {activeNav === 'Search' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', maxWidth: 480, padding: '8px 14px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              {searchQuery === '' ? (
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Start typing to search your files.</p>
              ) : filteredRecents.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No files matching "{searchQuery}"</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
                  {filteredRecents.map((f) => (
                    <FileCard key={f.filename + f.timestamp} file={f} onClick={() => handleOpenFile(f)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Shared with me view */}
          {activeNav === 'Shared with me' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>👥</div>
              <div style={{ color: 'var(--text-2)', fontSize: 14 }}>No shared files</div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Sharing is not available in this version.</div>
            </div>
          )}

          {/* Home / Recents view */}
          {(activeNav === 'Home' || activeNav === 'Recents') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
                  {activeNav === 'Recents' ? 'Recents' : 'Recents'}
                </h1>
                {filteredRecents.length > 6 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    style={{ background: 'none', color: 'var(--accent-light)', fontSize: 13 }}
                  >
                    View all ({filteredRecents.length}) →
                  </button>
                )}
                {showAll && (
                  <button
                    onClick={() => setShowAll(false)}
                    style={{ background: 'none', color: 'var(--accent-light)', fontSize: 13 }}
                  >
                    ← Show less
                  </button>
                )}
              </div>

              {displayedRecents.length === 0 ? (
                <EmptyState onNewFile={() => setShowNewFile(true)} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
                  {displayedRecents.map((f) => (
                    <FileCard key={f.filename + f.timestamp} file={f} onClick={() => handleOpenFile(f)} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showNewFile && (
        <NewFileDialog onClose={() => setShowNewFile(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

function NavItem({ icon, label, active, onClick, indent }: {
  icon: string; label: string; active?: boolean; onClick: () => void; indent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `6px 16px 6px ${indent ? 32 : 16}px`,
        background: active ? 'var(--bg-overlay)' : 'transparent',
        color: active ? 'var(--text-1)' : 'var(--text-2)',
        fontSize: 13, borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        width: '100%', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 14, minWidth: 16, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}

function FileCard({ file, onClick }: { file: RecentFile; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{
        height: 180, background: 'var(--bg-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 40, opacity: 0.2 }}>◆</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 500 }}>{file.filename}</div>
        <div style={{ color: 'var(--text-2)', fontSize: 11, marginTop: 3 }}>
          Edited {timeAgo(file.timestamp)}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNewFile }: { onNewFile: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 0', gap: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
      }}>◆</div>
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>No recent files</div>
      <button onClick={onNewFile} style={primaryBtnStyle}>
        Create your first file
      </button>
    </div>
  )
}

function DiamondLogo() {
  return (
    <div style={{
      width: 28, height: 28, background: 'var(--accent)',
      borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, color: '#fff',
    }}>◆</div>
  )
}

function IconBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} style={{
      width: 28, height: 28, borderRadius: 'var(--radius-sm)',
      background: 'transparent', color: 'var(--text-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
    }}>
      {children}
    </button>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff',
  borderRadius: 'var(--radius-sm)', padding: '6px 16px',
  fontWeight: 600, fontSize: 13,
}

const outlineBtnStyle: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-2)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '5px 14px', fontSize: 13,
}

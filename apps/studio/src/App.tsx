import React, { useState } from 'react'
import type { CanvasModel } from '@velicot/editor'
import { Home } from './pages/Home'
import { Editor } from './pages/Editor'
import { StateMachinePreview } from './pages/StateMachinePreview'

type Page =
  | { view: 'home' }
  | { view: 'editor'; filename: string; initialModel: CanvasModel | null }
  | { view: 'fsm-preview' }

export default function App() {
  const [page, setPage] = useState<Page>({ view: 'home' })

  const openEditor = (model: CanvasModel, filename: string) => {
    setPage({ view: 'editor', filename, initialModel: model })
  }

  const backToHome = () => setPage({ view: 'home' })

  if (page.view === 'editor') {
    return (
      <Editor
        filename={page.filename}
        initialModel={page.initialModel}
        onBackToHome={backToHome}
      />
    )
  }

  if (page.view === 'fsm-preview') {
    return <StateMachinePreview onBack={backToHome} />
  }

  return <Home onOpenEditor={openEditor} onOpenFsmPreview={() => setPage({ view: 'fsm-preview' })} />
}

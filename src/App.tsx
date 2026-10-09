import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { errorMessage, workbooks } from './lib/workbooks'
import type { Workbook } from './lib/workbooks'
import { WorkbookLibrary } from './components/WorkbookLibrary'
import { SheetMark } from './components/Icon'

const WorkbookEditor = lazy(() => import('./components/WorkbookEditor'))

function routeId() {
  return window.location.hash.match(/^#\/workbooks\/([a-f0-9]{32})$/)?.[1] || null
}

class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Spreadsheet initialization failed', error, info.componentStack) }
  render() {
    return this.state.failed ? <div className="app-loading"><SheetMark large /><p>表格编辑器加载失败，请刷新后重试。</p><button className="button" onClick={() => window.location.reload()}>刷新页面</button></div> : this.props.children
  }
}

export default function App() {
  const [id, setId] = useState(routeId)
  const currentId = useRef(id)
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null)
  const [resource, setResource] = useState<{ id: string; book?: Workbook; error?: string } | null>(null)

  useEffect(() => {
    let navigation = 0
    const onHashChange = async () => {
      const target = routeId()
      if (target === currentId.current) return
      const request = ++navigation
      if (leaveGuard.current && !await leaveGuard.current()) {
        if (request === navigation) window.history.replaceState(null, '', currentId.current ? `#/workbooks/${currentId.current}` : '#')
        return
      }
      if (request !== navigation) return
      currentId.current = target
      setResource(null)
      setId(target)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    workbooks.get(id, controller.signal).then(book => setResource({ id, book })).catch(error => {
      if (!controller.signal.aborted) setResource({ id, error: errorMessage(error) })
    })
    return () => controller.abort()
  }, [id])

  function open(target: string | null) { window.location.hash = target ? `/workbooks/${target}` : '' }
  function registerGuard(guard: (() => Promise<boolean>) | null) { leaveGuard.current = guard }

  const book = resource?.id === id ? resource.book : undefined
  const error = resource?.id === id ? resource.error : undefined

  return <>
    {!book && <title>Lim 表格</title>}
    <meta name="description" content="Lim 在线表格：编辑数据、使用公式、管理工作表并自动保存。" />
    {!id ? <WorkbookLibrary onOpen={open} />
      : error ? <div className="app-loading"><SheetMark large /><p role="alert">{error}</p><div className="dialog-actions"><button className="button" onClick={() => open(null)}>返回我的表格</button><button className="button primary" onClick={() => window.location.reload()}>重新加载</button></div></div>
        : book ? <EditorBoundary key={book.id}><Suspense fallback={<div className="app-loading" role="status"><SheetMark large /><p>正在加载表格编辑器…</p></div>}><WorkbookEditor book={book} onOpen={open} registerGuard={registerGuard} /></Suspense></EditorBoundary>
          : <div className="app-loading" role="status"><SheetMark large /><p>正在打开表格…</p></div>}
  </>
}

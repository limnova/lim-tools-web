import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button, Result, Spin } from 'antd'
import { errorMessage, workbooks } from './lib/workbooks'
import type { Workbook } from './lib/workbooks'
import { WorkbookLibrary } from './components/WorkbookLibrary'
import { SheetMark } from './components/SheetMark'

const WorkbookEditor = lazy(() => import('./components/WorkbookEditor'))

function routeId() {
  return window.location.hash.match(/^#\/workbooks\/([a-f0-9]{32})$/)?.[1] || null
}

function Loading({ text }: { text: string }) {
  return <div className="app-loading" role="status"><Spin size="large" /><p>{text}</p></div>
}

class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Spreadsheet initialization failed', error, info.componentStack) }
  render() {
    return this.state.failed
      ? <Result status="error" icon={<SheetMark large />} title="表格编辑器加载失败" subTitle="请刷新页面后重试。" extra={<Button onClick={() => window.location.reload()}>刷新页面</Button>} />
      : this.props.children
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
      : error ? <Result
        status="error"
        icon={<SheetMark large />}
        title="打开表格失败"
        subTitle={<span role="alert">{error}</span>}
        extra={[
          <Button key="back" onClick={() => open(null)}>返回我的表格</Button>,
          <Button key="reload" variant="solid" color="primary" onClick={() => window.location.reload()}>重新加载</Button>,
        ]}
      />
        : book ? <EditorBoundary key={book.id}><Suspense fallback={<Loading text="正在加载表格编辑器…" />}><WorkbookEditor book={book} onOpen={open} registerGuard={registerGuard} /></Suspense></EditorBoundary>
          : <Loading text="正在打开表格…" />}
  </>
}

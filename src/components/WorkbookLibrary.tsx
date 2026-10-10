import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Alert, Button, Empty, Input, Listy, Spin } from 'antd'
import { ArrowRightOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { blankWorkbook, budgetWorkbook, errorMessage, workbooks } from '../lib/workbooks'
import type { WorkbookSnapshot, WorkbookSummary } from '../lib/workbooks'
import { csvWorkbook, MAX_FILE_BYTES, readBackup } from '../lib/files'
import { Dialog } from './Dialog'
import { SheetMark } from './SheetMark'

export function WorkbookLibrary({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<WorkbookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<WorkbookSummary | null>(null)
  const [refresh, setRefresh] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    workbooks.list(controller.signal).then(data => {
      setItems(data.items)
    }).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])

  function reload(clearError = true) {
    setLoading(true)
    if (clearError) setError('')
    setRefresh(value => value + 1)
  }

  async function create(snapshot: WorkbookSnapshot) {
    if (busy) return
    setBusy(true)
    setError('')
    try { onOpen((await workbooks.create(snapshot.name, snapshot)).id) }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('导入文件不能超过 9 MB。')
      const text = await file.text()
      const name = file.name.replace(/\.(csv|json)$/i, '').slice(0, 120) || '导入表格'
      const snapshot = /\.csv$/i.test(file.name) ? csvWorkbook(text, name) : readBackup(text)
      await create(snapshot)
    } catch (error) { setError(errorMessage(error)) }
  }

  async function remove() {
    if (!deleting || busy) return
    setBusy(true)
    try {
      await workbooks.delete(deleting.id, deleting.revision)
      setItems(previous => previous.filter(item => item.id !== deleting.id))
      setDeleting(null)
      setError('')
    } catch (error) {
      setError(errorMessage(error))
      setDeleting(null)
      reload(false)
    } finally { setBusy(false) }
  }

  const filtered = items.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  return <div className="library-page">
    <header className="library-header"><a className="brand" href="#"><SheetMark /><span>Lim 表格</span></a><span className="workspace-label">我的工作区</span></header>
    <main className="library-main">
      <div className="page-heading"><div><h1>我的表格</h1><p>把想法、计划和数据，放进一张表。</p></div><Button variant="solid" color="primary" icon={<PlusOutlined aria-hidden />} disabled={busy} onClick={() => void create(blankWorkbook())}>新建表格</Button></div>
      {/* Kept as real <button> elements: they are actions, not content cards, and
          the browser tests reach them by the button role. */}
      <div className="start-options">
        <button className="start-option" disabled={busy} onClick={() => void create(blankWorkbook())}><span className="template-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /></span><span><strong>空白表格</strong><small>从第一格开始</small></span><span className="start-arrow" aria-hidden="true"><ArrowRightOutlined /></span></button>
        <button className="start-option" disabled={busy} onClick={() => void create(budgetWorkbook())}><span className="template-grid budget" aria-hidden="true"><span /><span /><span /><span /><span /><span /></span><span><strong>项目预算示例</strong><small>试用公式、格式与自动保存</small></span><span className="start-arrow" aria-hidden="true"><ArrowRightOutlined /></span></button>
      </div>
      <div className="list-tools"><span>全部表格 <span className="count">{items.length}</span></span><div className="list-actions">
        <Input className="search-field" aria-label="搜索表格" placeholder="搜索表格" prefix={<SearchOutlined aria-hidden />} allowClear value={search} onChange={event => setSearch(event.target.value)} />
        <Button icon={<UploadOutlined aria-hidden />} disabled={busy} onClick={() => fileInput.current?.click()}>导入文件</Button>
        <Button type="text" aria-label="刷新列表" icon={<ReloadOutlined aria-hidden />} onClick={() => reload()} />
      </div></div>
      <input ref={fileInput} type="file" accept=".csv,.json" className="visually-hidden" aria-label="导入 CSV 或 JSON 备份" onChange={event => void importFile(event)} />
      {error && <Alert className="notice" type="error" showIcon title={error} action={<Button variant="text" onClick={() => reload()}>重试</Button>} />}
      {loading ? <div className="empty-state" role="status"><Spin /></div>
        : filtered.length ? <div className="file-list">
          {/* Mirrors the row's flex slots so the column labels line up: mark (34),
              name (flexible), time (130), actions (36). */}
          <div className="file-list-heading"><span className="file-heading-mark" aria-hidden="true" /><span className="file-heading-name">名称</span><span className="file-heading-time">最后修改</span><span className="file-heading-actions" aria-hidden="true" /></div>
          <Listy
            classNames={{ item: 'file-row' }}
            rowKey="id"
            items={filtered}
            itemRender={item => <>
            <SheetMark />
            <button className="file-open" onClick={() => onOpen(item.id)}>{item.name}</button>
            <time dateTime={item.updatedAt}>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.updatedAt))}</time>
            <Button className="file-delete" type="text" aria-label={`删除 ${item.name}`} icon={<DeleteOutlined aria-hidden />} disabled={busy} onClick={() => setDeleting(item)} />
          </>}
          />
        </div>
          : <Empty className="empty-state" image={<SheetMark large />} description={<><h2>{search ? '没有匹配的表格' : '你的第一张表格，从这里开始'}</h2><p>{search ? '换个名称搜索，或清空搜索内容。' : '新建空白表格，也可以先打开项目预算示例。'}</p>{!search && <Button variant="text" disabled={busy} onClick={() => void create(blankWorkbook())}>新建一张表格 <PlusOutlined aria-hidden /></Button>}</>} />}
      <p className="file-hint">支持导入 CSV 与 JSON 备份。CSV 只包含单张工作表的数据。</p>
    </main>
    <footer className="library-footer">Lim Tools <span>让数据有条理</span></footer>
    {deleting && <Dialog title="删除表格" onClose={() => { if (!busy) setDeleting(null) }}><p>确定删除「{deleting.name}」？删除后无法恢复，建议先导出备份。</p><div className="dialog-actions"><Button disabled={busy} onClick={() => setDeleting(null)}>取消</Button><Button variant="solid" color="danger" disabled={busy} onClick={() => void remove()}>{busy ? '正在删除…' : '删除表格'}</Button></div></Dialog>}
  </div>
}

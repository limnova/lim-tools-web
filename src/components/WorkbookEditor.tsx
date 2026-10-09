import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Workbook } from '../lib/workbooks'
import { errorMessage, workbooks } from '../lib/workbooks'
import { downloadFile, sheetCsv, workbookBackup } from '../lib/files'
import { useWorkbookSave } from '../lib/useWorkbookSave'
import Spreadsheet from './Spreadsheet'
import type { SpreadsheetHandle } from './Spreadsheet'
import { Dialog } from './Dialog'
import { Icon, SheetMark } from './Icon'

interface Props {
  book: Workbook
  onOpen: (id: string | null) => void
  registerGuard: (guard: (() => Promise<boolean>) | null) => void
}

const statusLabels = { saved: '已保存', pending: '等待保存', saving: '正在保存…', error: '保存失败', conflict: '版本冲突' }

export default function WorkbookEditor({ book, onOpen, registerGuard }: Props) {
  const editor = useRef<SpreadsheetHandle | null>(null)
  const save = useWorkbookSave(book, editor)
  const [ready, setReady] = useState(false)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const exportMenu = useRef<HTMLDetailsElement>(null)
  const dataMenu = useRef<HTMLDetailsElement>(null)

  const leave = useEffectEvent(async () => {
    try { if (await save.flush()) return true }
    catch (error) { setNotice(errorMessage(error)) }
    if (window.confirm('当前修改还没有保存。离开会丢失这些修改，是否仍要离开？')) {
      save.discard()
      return true
    }
    return false
  })

  const saveShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void save.flush().catch(error => setNotice(errorMessage(error)))
    }
  })

  useEffect(() => {
    registerGuard(() => leave())
    const listener = (event: KeyboardEvent) => saveShortcut(event)
    window.addEventListener('keydown', listener, true)
    return () => {
      registerGuard(null)
      window.removeEventListener('keydown', listener, true)
    }
  }, [registerGuard])

  function onReady(handle: SpreadsheetHandle | null) {
    editor.current = handle
    setReady(handle !== null)
    if (handle) save.resume()
  }

  async function exportFile(format: 'csv' | 'json') {
    exportMenu.current?.removeAttribute('open')
    if (!editor.current) return
    try {
      await editor.current.commitEdit()
      const snapshot = editor.current.snapshot()
      snapshot.name = save.name.trim() || book.name
      if (format === 'json') downloadFile(workbookBackup(snapshot), `${snapshot.name}.json`, 'application/json;charset=utf-8')
      else {
        const sheetId = editor.current.activeSheetId()
        downloadFile(sheetCsv(snapshot, sheetId), `${snapshot.name}-${snapshot.sheets[sheetId].name}.csv`, 'text/csv;charset=utf-8')
      }
      setNotice('')
    } catch (error) { setNotice(errorMessage(error)) }
  }

  async function fork() {
    if (!editor.current || busy) return
    setBusy(true)
    try {
      await editor.current.commitEdit()
      const snapshot = editor.current.snapshot()
      const name = `${save.name.trim() || book.name}（副本）`.slice(0, 120)
      snapshot.name = name
      const copy = await workbooks.create(name, snapshot)
      save.discard()
      onOpen(copy.id)
    } catch (error) { setNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function dataAction(action: Parameters<SpreadsheetHandle['dataAction']>[0]) {
    dataMenu.current?.removeAttribute('open')
    if (!editor.current) return
    try {
      await editor.current.dataAction(action)
      setNotice('')
    } catch (error) { setNotice(errorMessage(error)) }
  }

  return <main className="editor-page">
    <title>{save.name || '未命名表格'} · Lim 表格</title>
    <header className="editor-header">
      <button className="icon-button back-button" aria-label="返回我的表格" onClick={() => onOpen(null)}><Icon name="back" size={20} /></button>
      <SheetMark />
      <div className="document-info"><input className="document-name" aria-label="表格名称" maxLength={120} disabled={busy} value={save.name} onChange={event => save.changeName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><div className={`save-status ${save.status}`} role="status"><Icon name={save.status === 'saved' ? 'check' : 'clock'} size={13} /><span>{save.editing ? '正在编辑' : statusLabels[save.status]}</span><time dateTime={save.updatedAt}>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(save.updatedAt))}</time></div></div>
      <div className="editor-actions"><button className="button save-button" disabled={!ready || busy || save.status === 'saving' || save.status === 'conflict'} onClick={() => void save.flush().catch(error => setNotice(errorMessage(error)))}><Icon name="check" size={16} /><span>{save.status === 'error' ? '重试保存' : '保存'}</span></button><details className="export-menu" ref={exportMenu}><summary className={`button ${!ready ? 'disabled' : ''}`}><Icon name="download" size={16} /><span>导出</span></summary><div className="menu-popover"><button disabled={!ready} onClick={() => void exportFile('csv')}>当前工作表 · CSV<small>数据值，可用 Excel 打开</small></button><button disabled={!ready} onClick={() => void exportFile('json')}>完整表格 · JSON 备份<small>保留公式、格式和所有工作表</small></button><button disabled={!ready || busy} onClick={() => { exportMenu.current?.removeAttribute('open'); void fork() }}>另存副本</button></div></details><button className="icon-button help-button" aria-label="使用帮助" onClick={() => setHelp(true)}><Icon name="help" size={20} /></button></div>
    </header>
    {save.message && <div className={`notice ${save.status === 'conflict' ? 'warning' : 'error'}`} role="alert"><span>{save.message}</span><div>{save.status === 'conflict' ? <><button className="text-button" disabled={busy} onClick={() => void fork()}>另存副本</button><button className="text-button" onClick={() => void exportFile('json')}>下载备份</button></> : <button className="text-button" onClick={() => void save.flush().catch(error => setNotice(errorMessage(error)))}>重试保存</button>}</div></div>}
    {notice && <div className="notice error" role="alert"><span>{notice}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
    <nav className="data-tools" aria-label="数据工具"><details className="export-menu" ref={dataMenu}><summary className="text-button">数据</summary><div className="menu-popover"><button disabled={!ready || busy} onClick={() => void dataAction('sortAscending')}>按选区首列升序<small>选中数据行，不包含标题行</small></button><button disabled={!ready || busy} onClick={() => void dataAction('sortDescending')}>按选区首列降序</button><button disabled={!ready || busy} onClick={() => void dataAction('toggleFilter')}>开启 / 关闭筛选<small>选中含标题行的数据范围</small></button></div></details><button className="text-button" disabled={!ready || busy} onClick={() => void dataAction('findReplace')}><Icon name="search" size={14} />查找与替换</button><span>选择数据范围后操作</span></nav>
    <div className="sheet-stage" inert={busy}><Spreadsheet initialSnapshot={book.snapshot} onReady={onReady} onChange={save.changed} onEditing={save.changeEditing} /></div>
    {help && <Dialog title="使用表格" onClose={() => setHelp(false)}><p>双击单元格或直接输入开始编辑，按 Enter 确认。输入 <code>=SUM(A1:A10)</code> 等公式即可计算。</p><dl className="shortcut-list"><div><dt>复制 / 粘贴</dt><dd>Ctrl / ⌘ + C / V</dd></div><div><dt>撤销 / 重做</dt><dd>Ctrl / ⌘ + Z / Shift + Z</dd></div><div><dt>立即保存</dt><dd>Ctrl / ⌘ + S</dd></div><div><dt>查找与替换</dt><dd>Ctrl / ⌘ + F</dd></div></dl><p>右键行列标题可以插入、删除或冻结行列。底部「+」新建工作表，右键工作表标签可以重命名或复制。</p><p className="muted">修改会自动保存到服务端。CSV 只导出当前工作表的值；JSON 备份可完整恢复。当前版本供单人编辑使用。</p><div className="dialog-actions"><button className="button primary" onClick={() => setHelp(false)}>知道了</button></div></Dialog>}
  </main>
}

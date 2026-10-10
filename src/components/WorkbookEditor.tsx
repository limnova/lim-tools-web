import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Alert, App as AntdApp, Button, Dropdown, Input, Space } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, ClockCircleOutlined, DownloadOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import type { Workbook } from '../lib/workbooks'
import { errorMessage, workbooks } from '../lib/workbooks'
import { downloadFile, sheetCsv, workbookBackup } from '../lib/files'
import { useWorkbookSave } from '../lib/useWorkbookSave'
import Spreadsheet from './Spreadsheet'
import type { SpreadsheetHandle } from './Spreadsheet'
import { Dialog } from './Dialog'
import { SheetMark } from './SheetMark'

interface Props {
  book: Workbook
  onOpen: (id: string | null) => void
  registerGuard: (guard: (() => Promise<boolean>) | null) => void
}

const statusLabels = { saved: '已保存', pending: '等待保存', saving: '正在保存…', error: '保存失败', conflict: '版本冲突' }

export default function WorkbookEditor({ book, onOpen, registerGuard }: Props) {
  const editor = useRef<SpreadsheetHandle | null>(null)
  const save = useWorkbookSave(book, editor)
  const { modal } = AntdApp.useApp()
  const [ready, setReady] = useState(false)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const leave = useEffectEvent(async () => {
    try { if (await save.flush()) return true }
    catch (error) { setNotice(errorMessage(error)) }
    // Modal.confirm is not promise-returning, so resolve the navigation guard
    // from the dialog's own callbacks.
    return new Promise<boolean>(resolve => {
      modal.confirm({
        title: '放弃未保存的修改？',
        content: '当前修改还没有保存。离开会丢失这些修改，是否仍要离开？',
        okText: '仍然离开',
        cancelText: '留在本页',
        okButtonProps: { danger: true },
        onOk: () => { save.discard(); resolve(true) },
        onCancel: () => resolve(false),
      })
    })
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
    if (!editor.current) return
    try {
      await editor.current.dataAction(action)
      setNotice('')
    } catch (error) { setNotice(errorMessage(error)) }
  }

  const retrySave = () => void save.flush().catch(error => setNotice(errorMessage(error)))
  const saveLabel = save.status === 'error' ? '重试保存' : '保存'

  return <main className="editor-page">
    <title>{save.name || '未命名表格'} · Lim 表格</title>
    <header className="editor-header">
      <Button type="text" className="back-button" aria-label="返回我的表格" icon={<ArrowLeftOutlined aria-hidden />} onClick={() => onOpen(null)} />
      <SheetMark />
      <div className="document-info"><Input className="document-name" variant="borderless" aria-label="表格名称" maxLength={120} disabled={busy} value={save.name} onChange={event => save.changeName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><div className={`save-status ${save.status}`} role="status">{save.status === 'saved' ? <CheckOutlined aria-hidden /> : <ClockCircleOutlined aria-hidden />}<span>{save.editing ? '正在编辑' : statusLabels[save.status]}</span><time dateTime={save.updatedAt}>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(save.updatedAt))}</time></div></div>
      <div className="editor-actions">
        {/* aria-label keeps the accessible name stable: the responsive CSS hides
            the label text on narrow screens, and the icon must not leak into it. */}
        <Button aria-label={saveLabel} icon={<CheckOutlined aria-hidden />} disabled={!ready || busy || save.status === 'saving' || save.status === 'conflict'} onClick={retrySave}><span className="save-label">{saveLabel}</span></Button>
        <Dropdown trigger={['click']} menu={{ items: [
          { key: 'csv', label: <>当前工作表 · CSV<small>数据值，可用 Excel 打开</small></>, disabled: !ready, onClick: () => void exportFile('csv') },
          { key: 'json', label: <>完整表格 · JSON 备份<small>保留公式、格式和所有工作表</small></>, disabled: !ready, onClick: () => void exportFile('json') },
          { key: 'fork', label: '另存副本', disabled: !ready || busy, onClick: () => void fork() },
        ] }}>{/* .export-menu is the handle the browser test uses to open this menu. */}
          <Button className="export-menu" icon={<DownloadOutlined aria-hidden />}><span>导出</span></Button>
        </Dropdown>
        <Button type="text" className="help-button" aria-label="使用帮助" icon={<QuestionCircleOutlined aria-hidden />} onClick={() => setHelp(true)} />
      </div>
    </header>
    {save.message && <Alert
      type={save.status === 'conflict' ? 'warning' : 'error'}
      showIcon
      title={save.message}
      action={save.status === 'conflict'
        ? <Space size={4}><Button variant="text" disabled={busy} onClick={() => void fork()}>另存副本</Button><Button variant="text" onClick={() => void exportFile('json')}>下载备份</Button></Space>
        : <Button variant="text" onClick={retrySave}>重试保存</Button>}
    />}
    {notice && <Alert type="error" showIcon title={notice} closable={{ onClose: () => setNotice('') }} />}
    <nav className="data-tools" aria-label="数据工具"><Dropdown trigger={['click']} menu={{ items: [
      { key: 'asc', label: <>按选区首列升序<small>选中数据行，不包含标题行</small></>, disabled: !ready || busy, onClick: () => void dataAction('sortAscending') },
      { key: 'desc', label: '按选区首列降序', disabled: !ready || busy, onClick: () => void dataAction('sortDescending') },
      { key: 'filter', label: <>开启 / 关闭筛选<small>选中含标题行的数据范围</small></>, disabled: !ready || busy, onClick: () => void dataAction('toggleFilter') },
    ] }}><Button variant="text" disabled={!ready || busy}>数据</Button></Dropdown><Button variant="text" disabled={!ready || busy} icon={<SearchOutlined aria-hidden />} onClick={() => void dataAction('findReplace')}>查找与替换</Button><span>选择数据范围后操作</span></nav>
    <div className="sheet-stage" inert={busy}><Spreadsheet initialSnapshot={book.snapshot} onReady={onReady} onChange={save.changed} onEditing={save.changeEditing} /></div>
    {help && <Dialog title="使用表格" onClose={() => setHelp(false)}><p>双击单元格或直接输入开始编辑，按 Enter 确认。输入 <code>=SUM(A1:A10)</code> 等公式即可计算。</p><dl className="shortcut-list"><div><dt>复制 / 粘贴</dt><dd>Ctrl / ⌘ + C / V</dd></div><div><dt>撤销 / 重做</dt><dd>Ctrl / ⌘ + Z / Shift + Z</dd></div><div><dt>立即保存</dt><dd>Ctrl / ⌘ + S</dd></div><div><dt>查找与替换</dt><dd>Ctrl / ⌘ + F</dd></div></dl><p>右键行列标题可以插入、删除或冻结行列。底部「+」新建工作表，右键工作表标签可以重命名或复制。</p><p className="muted">修改会自动保存到服务端。CSV 只导出当前工作表的值；JSON 备份可完整恢复。当前版本供单人编辑使用。</p><div className="dialog-actions"><Button variant="solid" color="primary" onClick={() => setHelp(false)}>知道了</Button></div></Dialog>}
  </main>
}

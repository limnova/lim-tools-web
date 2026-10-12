import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Spin, Table, Upload } from 'antd'
import type { TableProps } from 'antd'
import { ArrowRightOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { blankWorkbook, budgetWorkbook, errorMessage, workbooks } from '../lib/workbooks'
import type { WorkbookSnapshot, WorkbookSummary } from '../lib/workbooks'
import { csvWorkbook, MAX_FILE_BYTES, readBackup } from '../lib/files'
import { SheetMark } from './SheetMark'

export function WorkbookLibrary({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<WorkbookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<WorkbookSummary | null>(null)
  const [refresh, setRefresh] = useState(0)

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

  async function importFile(file: File) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('导入文件不能超过 9 MB。')
      const text = await file.text()
      const name = file.name.replace(/\.(csv|json)$/i, '').slice(0, 120) || '导入表格'
      const snapshot = /\.csv$/i.test(file.name) ? csvWorkbook(text, name) : readBackup(text)
      onOpen((await workbooks.create(snapshot.name, snapshot)).id)
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
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
  const columns: TableProps<WorkbookSummary>['columns'] = [
    {
      title: '名称',
      key: 'name',
      render: (_, item) => <div className="file-name"><SheetMark /><Button
        type="link"
        className="file-open"
        classNames={{ content: 'file-open-label' }}
        onClick={() => onOpen(item.id)}
      >{item.name}</Button></div>,
    },
    {
      title: '最后修改',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      responsive: ['md'],
      render: (updatedAt: string) => <time dateTime={updatedAt}>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(updatedAt))}</time>,
    },
    {
      title: <span className="visually-hidden">操作</span>,
      key: 'actions',
      width: 68,
      render: (_, item) => <Button type="text" danger aria-label={`删除 ${item.name}`} icon={<DeleteOutlined aria-hidden />} disabled={busy} onClick={() => setDeleting(item)} />,
    },
  ]

  return <div className="library-page">
    <header className="library-header"><a className="brand" href="#"><SheetMark /><span>Lim 表格</span></a><span className="workspace-label">我的工作区</span></header>
    <main className="library-main">
      <div className="page-heading"><div><h1>我的表格</h1><p>把想法、计划和数据，放进一张表。</p></div><Button variant="solid" color="primary" icon={<PlusOutlined aria-hidden />} disabled={busy} onClick={() => void create(blankWorkbook())}>新建表格</Button></div>
      <div className="start-options">
        <Button className="start-option" classNames={{ content: 'start-option-content' }} disabled={busy} onClick={() => void create(blankWorkbook())}><span><span className="template-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /></span><span><strong>空白表格</strong><small>从第一格开始</small></span><span className="start-arrow" aria-hidden="true"><ArrowRightOutlined /></span></span></Button>
        <Button className="start-option" classNames={{ content: 'start-option-content' }} disabled={busy} onClick={() => void create(budgetWorkbook())}><span><span className="template-grid budget" aria-hidden="true"><span /><span /><span /><span /><span /><span /></span><span><strong>项目预算示例</strong><small>试用公式、格式与自动保存</small></span><span className="start-arrow" aria-hidden="true"><ArrowRightOutlined /></span></span></Button>
      </div>
      <div className="list-tools"><span>全部表格 <span className="count">{items.length}</span></span><div className="list-actions">
        <Input className="search-field" aria-label="搜索表格" placeholder="搜索表格" prefix={<SearchOutlined aria-hidden />} allowClear value={search} onChange={event => setSearch(event.target.value)} />
        <Upload className="file-upload" accept=".csv,.json" disabled={busy} showUploadList={false} beforeUpload={async file => {
          await importFile(file)
          return Upload.LIST_IGNORE
        }}><Button icon={<UploadOutlined aria-hidden />} disabled={busy}>导入文件</Button></Upload>
        <Button type="text" aria-label="刷新列表" icon={<ReloadOutlined aria-hidden />} onClick={() => reload()} />
      </div></div>
      {error && <Alert className="notice" type="error" showIcon title={error} action={<Button variant="text" onClick={() => reload()}>重试</Button>} />}
      {loading ? <div className="empty-state" role="status"><Spin /></div>
        : filtered.length ? <Table<WorkbookSummary> className="file-list" rowClassName="file-row" rowKey="id" columns={columns} dataSource={filtered} pagination={false} tableLayout="fixed" />
          : <Empty className="empty-state" image={<SheetMark large />} description={<><h2>{search ? '没有匹配的表格' : '你的第一张表格，从这里开始'}</h2><p>{search ? '换个名称搜索，或清空搜索内容。' : '新建空白表格，也可以先打开项目预算示例。'}</p>{!search && <Button variant="text" disabled={busy} onClick={() => void create(blankWorkbook())}>新建一张表格 <PlusOutlined aria-hidden /></Button>}</>} />}
      <p className="file-hint">支持导入 CSV 与 JSON 备份。CSV 只包含单张工作表的数据。</p>
    </main>
    <footer className="library-footer">Lim Tools <span>让数据有条理</span></footer>
    <Modal title="删除表格" open={deleting !== null} centered
      onCancel={() => { if (!busy) setDeleting(null) }} onOk={() => void remove()}
      okText="删除表格" cancelText="取消" confirmLoading={busy}
      okButtonProps={{ danger: true }} cancelButtonProps={{ disabled: busy }}
      closable={!busy} keyboard={!busy} mask={{ closable: !busy }}
    ><p>确定删除「{deleting?.name}」？删除后无法恢复，建议先导出备份。</p></Modal>
  </div>
}

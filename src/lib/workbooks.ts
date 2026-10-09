import type { IWorkbookData, LocaleType } from '@univerjs/presets'

export type WorkbookSnapshot = IWorkbookData

export interface WorkbookSummary {
  id: string
  name: string
  revision: number
  createdAt: string
  updatedAt: string
}

export interface Workbook extends WorkbookSummary {
  snapshot: WorkbookSnapshot
}

export class WorkbookError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'WorkbookError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(20_000)
    response = await fetch(`/api/v1/workbooks${path}`, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new WorkbookError('连接失败，请检查网络并确认服务已启动。', 0, 'network_error')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new WorkbookError(data?.message || '操作失败，请稍后重试。', response.status, data?.code || 'request_error')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const workbooks = {
  list: (signal?: AbortSignal) => request<{ items: WorkbookSummary[] }>('', { signal }),
  get: (id: string, signal?: AbortSignal) => request<Workbook>(`/${encodeURIComponent(id)}`, { signal }),
  create: (name: string, snapshot: WorkbookSnapshot) => request<Workbook>('', {
    method: 'POST', body: JSON.stringify({ name, snapshot }),
  }),
  save: (id: string, name: string, revision: number, snapshot: WorkbookSnapshot) => request<WorkbookSummary>(`/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify({ name, revision, snapshot }),
  }),
  delete: (id: string, revision: number) => request<void>(`/${encodeURIComponent(id)}?revision=${revision}`, { method: 'DELETE' }),
}

export function blankWorkbook(name = '未命名表格'): WorkbookSnapshot {
  const sheetId = crypto.randomUUID()
  return {
    id: crypto.randomUUID(), name, appVersion: '1.0.3', locale: 'zhCN' as LocaleType,
    styles: {}, sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId, name: '工作表1', rowCount: 1000, columnCount: 26,
        defaultRowHeight: 28, defaultColumnWidth: 112, cellData: {},
      },
    },
  }
}

export function budgetWorkbook(): WorkbookSnapshot {
  const snapshot = blankWorkbook('项目预算')
  const sheet = snapshot.sheets[snapshot.sheetOrder[0]]
  sheet.name = '预算明细'
  sheet.freeze = { startRow: 1, startColumn: -1, xSplit: 0, ySplit: 1 }
  sheet.columnData = { 0: { w: 196 }, 1: { w: 140 }, 5: { w: 230 } }
  snapshot.styles = {
    header: { bg: { rgb: '#e9f4ef' }, cl: { rgb: '#1b6b54' }, bl: 1, fs: 11 },
    currency: { n: { pattern: '¥#,##0.00' } },
    total: { bg: { rgb: '#e9f4ef' }, bl: 1, n: { pattern: '¥#,##0.00' } },
  }
  const rows = [
    ['项目', '负责人', '数量', '单价', '小计', '备注'],
    ['设计与原型', '林悦', 12, 600, null, '界面设计与交互验证'],
    ['前端开发', '陈晨', 20, 800, null, '表格编辑与文件管理'],
    ['服务端开发', '周宁', 16, 800, null, '自动保存与版本校验'],
    ['测试与验收', '李可', 8, 500, null, '公式、持久化与浏览器检查'],
    ['部署与维护', '陈晨', 4, 400, null, '基础运行环境'],
  ]
  sheet.cellData = {}
  rows.forEach((row, r) => {
    const cells: NonNullable<typeof sheet.cellData>[number] = {}
    row.forEach((value, c) => {
      cells[c] = r === 0 ? { v: value, s: 'header' }
        : c === 4 ? { f: `=C${r + 1}*D${r + 1}`, s: 'currency' }
          : { v: value, ...(c === 3 ? { s: 'currency' } : {}) }
    })
    sheet.cellData![r] = cells
  })
  sheet.cellData[7] = { 0: { v: '预算合计', s: 'header' }, 4: { f: '=SUM(E2:E6)', s: 'total' } }
  sheet.cellData[9] = { 0: { v: '试着修改数量或单价，小计和合计会自动更新。' } }
  return snapshot
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}

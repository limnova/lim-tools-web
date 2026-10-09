import type { ICellData } from '@univerjs/presets'
import type { WorkbookSnapshot } from './workbooks'
import { blankWorkbook } from './workbooks.ts'

const MAX_CELLS = 200_000
export const MAX_FILE_BYTES = 9 * 1024 * 1024

// A strict CSV state machine: quoted commas/newlines, escaped quotes and CRLF
// are supported. Reject malformed files instead of silently shifting columns.
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  if (!text.trim()) throw new Error('CSV 文件为空，请选择有内容的文件。')
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false, cells = 0
  function pushField() {
    row.push(field)
    cells++
    if (row.length > 1024 || cells > MAX_CELLS) throw new Error('CSV 超过 1,024 列或 200,000 个单元格。')
    field = ''
    closed = false
  }
  function pushRow() {
    pushField()
    rows.push(row)
    if (rows.length > 100_000) throw new Error('CSV 超过 100,000 行。')
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closed = true }
      } else field += char
    } else if (char === ',') pushField()
    else if (char === '\r' || char === '\n') {
      pushRow()
      if (char === '\r' && text[i + 1] === '\n') i++
    } else if (char === '"' && field === '' && !closed) quoted = true
    else {
      if (closed || char === '"') throw new Error('CSV 引号格式不正确，请检查文件后重试。')
      field += char
    }
  }
  if (quoted) throw new Error('CSV 中有未闭合的引号。')
  if (row.length || field !== '' || closed || text.endsWith(',')) pushRow()
  return rows
}

export function csvWorkbook(text: string, name: string): WorkbookSnapshot {
  const rows = parseCsv(text)
  const snapshot = blankWorkbook(name)
  const sheet = snapshot.sheets[snapshot.sheetOrder[0]]
  sheet.name = '导入数据'
  sheet.rowCount = Math.max(1000, rows.length)
  sheet.columnCount = rows.reduce((width, row) => Math.max(width, row.length), 26)
  sheet.cellData = {}
  rows.forEach((row, r) => {
    const cells: Record<number, ICellData> = {}
    row.forEach((value, c) => {
      if (value !== '') {
        // Keep leading zeros and formula-looking text as text. Imported files
        // never create executable spreadsheet formulas.
        const numeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
        const number = Number(value)
        const safeNumber = numeric && Number.isFinite(number) && (Math.abs(number) <= Number.MAX_SAFE_INTEGER)
        cells[c] = safeNumber ? { v: number, t: 2 } : { v: value, t: 1 }
      }
    })
    sheet.cellData![r] = cells
  })
  return snapshot
}

export function sheetCsv(snapshot: WorkbookSnapshot, sheetId: string): string {
  const data = snapshot.sheets[sheetId]?.cellData || {}
  let lastRow = -1, lastColumn = -1
  for (const [r, columns] of Object.entries(data)) {
    for (const [c, cell] of Object.entries<ICellData | null>(columns || {})) {
      if (cell && (cell.v != null || cell.p || cell.f)) {
        lastRow = Math.max(lastRow, Number(r))
        lastColumn = Math.max(lastColumn, Number(c))
      }
    }
  }
  if ((lastRow + 1) * (lastColumn + 1) > MAX_CELLS) {
    throw new Error('当前工作表的已用范围超过 200,000 格，请缩小范围后导出。')
  }
  const rows: string[] = []
  for (let r = 0; r <= lastRow; r++) {
    const fields: string[] = []
    for (let c = 0; c <= lastColumn; c++) {
      const cell = data[r]?.[c]
      const value = cell?.v ?? cell?.p?.body?.dataStream.replace(/\r?\n$/, '') ?? ''
      let text = String(value)
      // CSV quoting alone does not prevent formula execution in Excel.
      if (typeof value === 'string' && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
      fields.push(/[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text)
    }
    rows.push(fields.join(','))
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`
}

export function workbookBackup(snapshot: WorkbookSnapshot): string {
  return JSON.stringify({ format: 'lim-tools-workbook', version: 1, snapshot }, null, 2)
}

export function readBackup(text: string): WorkbookSnapshot {
  const data = JSON.parse(text)
  const snapshot = data?.format === 'lim-tools-workbook' && data?.version === 1 ? data.snapshot : null
  if (!snapshot || typeof snapshot.name !== 'string' || !Array.isArray(snapshot.sheetOrder) ||
    snapshot.sheetOrder.length === 0 || !snapshot.sheets || typeof snapshot.sheets !== 'object') {
    throw new Error('请选择从 Lim 表格导出的 JSON 备份。')
  }
  // The server validates all sheets and dimensions and assigns a fresh file ID.
  return snapshot as WorkbookSnapshot
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = [...name.replace(/[<>:"/\\|?*]/g, '_')].map(char => char < ' ' ? '_' : char).join('')
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

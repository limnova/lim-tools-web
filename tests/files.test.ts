import assert from 'node:assert/strict'
import test from 'node:test'
import { csvWorkbook, parseCsv, readBackup, sheetCsv, workbookBackup } from '../src/lib/files.ts'

test('CSV reads BOM, quoted delimiters, escaped quotes, CRLF and multiline fields', () => {
  assert.deepEqual(parseCsv('\uFEFF姓名,备注\r\n林悦,"预算,设计"\r\n陈晨,"第一行\n""第二行"""\r\n'), [
    ['姓名', '备注'], ['林悦', '预算,设计'], ['陈晨', '第一行\n"第二行"'],
  ])
  assert.deepEqual(parseCsv('a,b,'), [['a', 'b', '']])
  assert.deepEqual(parseCsv('""'), [['']])
})

test('CSV rejects malformed quotes and excessive dimensions', () => {
  for (const value of ['', '"unclosed', '"a"b,c', 'a"b,c']) assert.throws(() => parseCsv(value))
  assert.throws(() => parseCsv(Array(1025).fill('x').join(',')), /1,024/)
  assert.throws(() => parseCsv(Array(200001).fill('x').join('\n')), /100,000|200,000/)
})

test('CSV import preserves identifiers and never executes formula-looking text', () => {
  const snapshot = csvWorkbook('编号,文本,数量\n00123,=SUM(A1:A5),10\n9007199254740993,+cmd,-5', '导入')
  const cells = snapshot.sheets[snapshot.sheetOrder[0]].cellData!
  assert.equal(cells[1][0].v, '00123')
  assert.equal(cells[1][1].v, '=SUM(A1:A5)')
  assert.equal(cells[1][1].t, 1)
  assert.equal(cells[1][1].f, undefined)
  assert.equal(cells[1][2].v, 10)
  assert.equal(cells[2][0].v, '9007199254740993')
  assert.equal(cells[2][2].v, -5)
})

test('CSV export quotes multiline text, exports computed values and protects text formulas', () => {
  const snapshot = csvWorkbook('a,b,c\n1,2,3', '导出')
  const id = snapshot.sheetOrder[0]
  snapshot.sheets[id].cellData![1] = {
    0: { v: 'hello,"world"\nnext' }, 1: { f: '=SUM(A2:A3)', v: 5 },
    2: { v: '=CMD()' }, 3: { v: -5 }, 4: { v: '\t=CMD()' },
  }
  const rows = parseCsv(sheetCsv(snapshot, id))
  assert.deepEqual(rows[1], ['hello,"world"\nnext', '5', "'=CMD()", '-5', "'\t=CMD()"])
  assert.equal(rows.length, 2)
})

test('JSON backup retains all worksheets, formulas, styles and resources', () => {
  const snapshot = csvWorkbook('a,b\n1,2', '备份')
  snapshot.styles = { bold: { bl: 1 } }
  snapshot.sheets[snapshot.sheetOrder[0]].cellData![2] = { 0: { f: '=SUM(A2:B2)', s: 'bold' } }
  snapshot.resources = [{ name: 'filter', data: '{"enabled":true}' }]
  snapshot.sheetOrder.push('second')
  snapshot.sheets.second = { id: 'second', name: '工作表2', rowCount: 1000, columnCount: 26 }
  assert.deepEqual(readBackup(workbookBackup(snapshot)), snapshot)
  assert.throws(() => readBackup('{"format":"unknown"}'), /JSON/)
})

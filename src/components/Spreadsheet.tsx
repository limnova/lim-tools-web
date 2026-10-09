import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { CommandType, createUniver, defaultTheme, IUniverInstanceService, LifecycleStages, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import coreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import filterZhCN from '@univerjs/preset-sheets-filter/locales/zh-CN'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import sortZhCN from '@univerjs/preset-sheets-sort/locales/zh-CN'
import { OpenReplaceDialogOperation, UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace'
import findZhCN from '@univerjs/preset-sheets-find-replace/locales/zh-CN'
import type { WorkbookSnapshot } from '../lib/workbooks'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'
import '@univerjs/preset-sheets-find-replace/lib/index.css'

export interface SpreadsheetHandle {
  snapshot: () => WorkbookSnapshot
  activeSheetId: () => string
  commitEdit: () => Promise<boolean>
  dataAction: (action: 'sortAscending' | 'sortDescending' | 'toggleFilter' | 'findReplace') => Promise<void>
}

interface Props {
  initialSnapshot: WorkbookSnapshot
  onReady: (handle: SpreadsheetHandle | null) => void
  onChange: () => void
  onEditing: (editing: boolean) => void
}

export default function Spreadsheet({ initialSnapshot, onReady, onChange, onEditing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failure, setFailure] = useState<Error | null>(null)
  const ready = useEffectEvent(onReady)
  const changed = useEffectEvent(onChange)
  const editing = useEffectEvent(onEditing)

  useEffect(() => {
    const host = containerRef.current
    if (!host) return
    let cancelled = false
    let dispose: (() => void) | undefined
    // Defer creation so StrictMode's mount/cleanup/mount probe cannot create
    // competing editor roots or duplicate portal IDs.
    queueMicrotask(() => {
      if (cancelled) return
      const container = document.createElement('div')
      container.className = 'sheet-instance'
      host.append(container)
      let instance: ReturnType<typeof createUniver> | undefined
      try {
        instance = createUniver({
          locale: LocaleType.ZH_CN,
          locales: { [LocaleType.ZH_CN]: mergeLocales(coreZhCN, filterZhCN, sortZhCN, findZhCN) },
          theme: {
            ...defaultTheme,
            primary: { ...defaultTheme.primary, 50: '#e9f4ef', 100: '#d8eae1', 200: '#b7d7c6', 300: '#84b49c', 400: '#42906f', 500: '#1b6b54', 600: '#155340', 700: '#124534', 800: '#103a2d', 900: '#0d3026' },
          },
          presets: [
            UniverSheetsCorePreset({ container, header: true, toolbar: true, formulaBar: true, ribbonType: 'simple' }),
            UniverSheetsFilterPreset(), UniverSheetsSortPreset(), UniverSheetsFindReplacePreset(),
          ],
        })
        const { univer, univerAPI } = instance
        const book = univerAPI.createWorkbook(initialSnapshot)
        const handle: SpreadsheetHandle = {
          snapshot: () => book.save(),
          activeSheetId: () => book.getActiveSheet().getSheetId(),
          commitEdit: () => book.endEditingAsync(true),
          dataAction: async action => {
            await book.endEditingAsync(true)
            if (action === 'findReplace') {
              // This control lives outside Univer's toolbar. Restore workbook
              // focus before the shared find service chooses its provider.
              univer.__getInjector().get(IUniverInstanceService).focusUnit(book.getId())
              await univerAPI.executeCommand(OpenReplaceDialogOperation.id)
              return
            }
            const sheet = book.getActiveSheet()
            const filter = sheet.getFilter()
            if (action === 'toggleFilter' && filter) { filter.remove(); return }
            const range = sheet.getSelection()?.getActiveRange()
            if (!range || range.getHeight() < 2) throw new Error('请先选中至少两行数据。筛选范围需要包含标题行，排序范围请排除标题行。')
            if (action === 'toggleFilter') {
              if (!range.createFilter()) throw new Error('无法创建筛选，请检查所选范围。')
            } else range.sort({ column: 0, ascending: action === 'sortAscending' })
          },
        }
        const listeners = [
          univerAPI.addEvent(univerAPI.Event.CommandExecuted, event => {
            // Calculations and internal document editors emit mutations too.
            // Opening a file or moving selection must not create a revision.
            if (event.type === CommandType.MUTATION && !event.options?.fromCollab &&
              !event.options?.onlyLocal && !event.id.startsWith('doc.') && !event.id.startsWith('formula.')) changed()
          }),
          univerAPI.addEvent(univerAPI.Event.SheetEditStarted, () => editing(true)),
          univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => editing(false)),
          univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({ stage }) => {
            if (stage === LifecycleStages.Steady) queueMicrotask(() => { if (!cancelled) ready(handle) })
          }),
        ]
        // Find/replace registers its provider at Steady, after the first paint.
        // Do not expose enabled actions before their plugins are available.
        if (univerAPI.getCurrentLifecycleStage() >= LifecycleStages.Steady) ready(handle)
        dispose = () => {
          ready(null)
          listeners.forEach(listener => listener.dispose())
          container.hidden = true
          // Univer owns a nested React root; dispose after the parent commit.
          queueMicrotask(() => { univer.dispose(); container.remove() })
        }
      } catch (error) {
        instance?.univer.dispose()
        container.remove()
        setFailure(error instanceof Error ? error : new Error('表格初始化失败'))
      }
    })
    return () => { cancelled = true; dispose?.() }
  }, [initialSnapshot])

  if (failure) throw failure
  return <div ref={containerRef} className="spreadsheet" aria-label="表格编辑区域" />
}

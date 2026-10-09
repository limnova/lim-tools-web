import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { SpreadsheetHandle } from '../components/Spreadsheet'
import { errorMessage, WorkbookError, workbooks } from './workbooks'
import type { Workbook } from './workbooks'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict'

export function useWorkbookSave(book: Workbook, editor: RefObject<SpreadsheetHandle | null>) {
  const [name, setName] = useState(book.name)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(book.updatedAt)
  const currentName = useRef(book.name)
  const generation = useRef(0)
  const savedGeneration = useRef(0)
  const revision = useRef(book.revision)
  const conflict = useRef(false)
  const editingCell = useRef(false)
  const discarded = useRef(false)
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)

  function cancelTimer() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  function schedule() {
    cancelTimer()
    if (!conflict.current && !editingCell.current) {
      timer.current = setTimeout(() => { void persist() }, 900)
    }
  }

  function changed() {
    generation.current++
    if (!conflict.current) setStatus('pending')
    schedule()
  }

  function changeName(value: string) {
    currentName.current = value
    setName(value)
    changed()
  }

  function changeEditing(value: boolean) {
    editingCell.current = value
    setEditing(value)
    if (value) cancelTimer()
    else if (generation.current !== savedGeneration.current) schedule()
  }

  async function persist(): Promise<boolean> {
    cancelTimer()
    if (discarded.current) return true
    if (conflict.current) return false
    if (inFlight.current) {
      if (!await inFlight.current) return false
      return persist()
    }
    if (generation.current === savedGeneration.current) return true
    if (editingCell.current || !editor.current) return false
    const trimmedName = currentName.current.trim()
    if (!trimmedName) {
      setStatus('error')
      setMessage('请输入表格名称后再保存。')
      return false
    }
    const sentGeneration = generation.current
    let snapshot
    try {
      snapshot = editor.current.snapshot()
      snapshot.name = trimmedName
    } catch (error) {
      setStatus('error')
      setMessage(errorMessage(error))
      return false
    }
    const task = (async () => {
      setStatus('saving')
      setMessage('')
      try {
        const saved = await workbooks.save(book.id, trimmedName, revision.current, snapshot)
        revision.current = saved.revision
        savedGeneration.current = sentGeneration
        if (mounted.current) {
          setUpdatedAt(saved.updatedAt)
          setStatus(generation.current === sentGeneration ? 'saved' : 'pending')
        }
        return true
      } catch (error) {
        conflict.current = error instanceof WorkbookError && error.status === 409
        if (mounted.current) {
          setStatus(conflict.current ? 'conflict' : 'error')
          setMessage(errorMessage(error))
        }
        return false
      } finally {
        inFlight.current = null
      }
    })()
    inFlight.current = task
    if (!await task) return false
    // Edits made while a request was in flight belong to a later revision.
    // Never mark those edits saved just because the earlier request succeeded.
    if (generation.current !== savedGeneration.current) return persist()
    return true
  }

  async function flush(): Promise<boolean> {
    if (discarded.current) return true
    if (!editor.current) return generation.current === savedGeneration.current
    await editor.current.commitEdit()
    return persist()
  }

  function discard() {
    discarded.current = true
    cancelTimer()
  }

  function resume() {
    if (generation.current !== savedGeneration.current) schedule()
  }

  const beforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (!discarded.current && (generation.current !== savedGeneration.current || editingCell.current)) {
      event.preventDefault()
      event.returnValue = ''
    }
  })

  useEffect(() => {
    mounted.current = true
    const listener = (event: BeforeUnloadEvent) => beforeUnload(event)
    window.addEventListener('beforeunload', listener)
    return () => {
      mounted.current = false
      cancelTimer()
      window.removeEventListener('beforeunload', listener)
    }
  }, [])

  return { name, status, message, editing, updatedAt, changed, changeName, changeEditing, flush, discard, resume }
}

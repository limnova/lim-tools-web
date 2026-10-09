import { useDeferredValue, useState, useTransition } from 'react'
import { buttonClass, inputClass } from './Card'

const buildItems = (count: number) =>
  Array.from({ length: count }, (_, index) => `条目 ${index + 1}`)

export function TransitionDemo() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(() => buildItems(300))
  const [isPending, startTransition] = useTransition()

  // 输入框保持即时响应，列表用延后的值去筛
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery
  const keyword = deferredQuery.trim()
  const filtered = items.filter((item) => item.includes(keyword))

  return (
    <>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选条目"
          className={inputClass}
        />
        <button
          type="button"
          className={buttonClass}
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              setItems(buildItems(items.length + 2000))
            })
          }
        >
          {isPending ? '生成中…' : '+2000 条'}
        </button>
      </div>

      <p className="text-slate-500 dark:text-slate-400">
        {isPending ? '正在生成新列表…' : `${filtered.length} / ${items.length} 条`}
        {isStale && ' · 结果更新中'}
      </p>

      <ul className="max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        {filtered.slice(0, 50).map((item) => (
          <li
            key={item}
            className="border-b border-slate-100 px-3 py-1 last:border-b-0 dark:border-slate-800/60"
          >
            {item}
          </li>
        ))}
      </ul>
    </>
  )
}

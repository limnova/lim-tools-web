import { useRef, useState } from 'react'
import { buttonClass } from './Card'
import { SearchInput } from './SearchInput'

const FRUITS = ['苹果', '香蕉', '橙子', '葡萄', '西瓜', '哈密瓜', '草莓']

export function RefAsPropDemo() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  const matched = FRUITS.filter((fruit) => fruit.includes(query.trim()))

  return (
    <>
      <div className="flex gap-2">
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入「瓜」试试"
        />
        <button
          type="button"
          className={buttonClass}
          onClick={() => inputRef.current?.focus()}
        >
          聚焦
        </button>
      </div>

      <p className="text-slate-500 dark:text-slate-400">
        {matched.length > 0
          ? `匹配到：${matched.join('、')}`
          : '没有匹配的水果'}
      </p>
    </>
  )
}

import type { ChangeEvent, Ref } from 'react'

type SearchInputProps = {
  /**
   * React 19 起 ref 就是普通 prop，组件不再需要用 forwardRef 包一层。
   */
  ref?: Ref<HTMLInputElement>
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}

export function SearchInput({
  ref,
  value,
  onChange,
  placeholder,
}: SearchInputProps) {
  return (
    <input
      ref={ref}
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
    />
  )
}

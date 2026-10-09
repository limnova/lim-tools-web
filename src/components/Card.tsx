import type { ReactNode } from 'react'

type CardProps = {
  title: string
  api: string
  description: string
  children: ReactNode
}

export function Card({ title, api, description, children }: CardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-sky-700 dark:bg-slate-800 dark:text-sky-400">
            {api}
          </code>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </header>
      <div className="flex flex-col gap-3 text-sm">{children}</div>
    </section>
  )
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

export const buttonClass =
  'rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50'

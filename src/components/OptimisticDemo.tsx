import { useOptimistic, useRef, useState } from 'react'
import { sleep } from '../lib/api'
import { buttonClass, inputClass } from './Card'

type Message = {
  id: string
  text: string
  pending?: boolean
}

const INITIAL_MESSAGES: Message[] = [
  { id: 'm1', text: '脚手架已经跑起来了' },
  { id: 'm2', text: 'Tailwind v4 不再需要 postcss 配置' },
]

export function OptimisticDemo() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const formRef = useRef<HTMLFormElement>(null)

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current: Message[], text: string) => [
      ...current,
      { id: `pending-${text}`, text, pending: true },
    ],
  )

  async function send(formData: FormData) {
    const text = String(formData.get('text') ?? '').trim()
    if (!text) return

    addOptimisticMessage(text) // 先上屏，不等网络
    formRef.current?.reset()

    await sleep(1200) // 模拟一次请求往返
    setMessages((current) => [...current, { id: crypto.randomUUID(), text }])
  }

  return (
    <form ref={formRef} action={send} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input name="text" placeholder="说点什么" className={inputClass} />
        <button type="submit" className={buttonClass}>
          发送
        </button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {optimisticMessages.map((message) => (
          <li
            key={message.id}
            className={
              message.pending
                ? 'rounded-lg bg-slate-100 px-3 py-1.5 text-slate-400 italic dark:bg-slate-800/60 dark:text-slate-500'
                : 'rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }
          >
            {message.text}
            {message.pending && ' · 发送中'}
          </li>
        ))}
      </ul>
    </form>
  )
}

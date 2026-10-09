import { useActionState } from 'react'
import { subscribeEmail } from '../lib/api'
import { buttonClass, inputClass } from './Card'

type SubscribeState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null

async function subscribe(
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const email = String(formData.get('email') ?? '').trim()
  try {
    const result = await subscribeEmail(email)
    return { ok: true, email: result.email }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '提交失败，请重试',
    }
  }
}

export function ActionStateDemo() {
  const [state, formAction, isPending] = useActionState(subscribe, null)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          className={inputClass}
        />
        <button type="submit" className={buttonClass} disabled={isPending}>
          {isPending ? '提交中…' : '订阅'}
        </button>
      </div>

      {state?.ok === true && (
        <p className="text-emerald-600 dark:text-emerald-400">
          已订阅 {state.email}
        </p>
      )}
      {state?.ok === false && (
        <p className="text-rose-600 dark:text-rose-400">{state.error}</p>
      )}
      {state === null && (
        <p className="text-slate-500 dark:text-slate-400">
          表单提交后 pending 状态和结果都由 React 托管。
        </p>
      )}
    </form>
  )
}

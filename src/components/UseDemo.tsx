import { Suspense, use, useState } from 'react'
import { fetchTodos, type Todo } from '../lib/api'
import { buttonClass } from './Card'

function TodoList({ promise }: { promise: Promise<Todo[]> }) {
  // use() 可以在渲染中直接读 Promise，配合上层 <Suspense> 使用
  const todos = use(promise)

  return (
    <ul className="flex flex-col gap-1.5">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {todo.title}
        </li>
      ))}
    </ul>
  )
}

export function UseDemo() {
  const [request, setRequest] = useState<Promise<Todo[]> | null>(null)

  return (
    <>
      <button
        type="button"
        className={`${buttonClass} self-start`}
        onClick={() => setRequest(fetchTodos())}
      >
        {request ? '重新加载' : '加载待办'}
      </button>

      <Suspense
        fallback={
          <p className="text-slate-400 dark:text-slate-500">加载中…</p>
        }
      >
        {request ? (
          <TodoList promise={request} />
        ) : (
          <p className="text-slate-500 dark:text-slate-400">
            Promise 存在 state 里保持稳定，点按钮才开始请求。
          </p>
        )}
      </Suspense>
    </>
  )
}

export type Todo = {
  id: number
  title: string
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 假的接口：用来演示 use() 读取 Promise */
export async function fetchTodos(): Promise<Todo[]> {
  await sleep(800)
  return [
    { id: 1, title: '把 <title> 写进组件里，不再靠 react-helmet' },
    { id: 2, title: 'form action 直接用 async 函数' },
    { id: 3, title: 'ref 当普通 prop 传，告别 forwardRef' },
  ]
}

/** 假的接口：用来演示 useActionState 的表单提交 */
export async function subscribeEmail(
  email: string,
): Promise<{ ok: true; email: string }> {
  await sleep(900)
  if (!email.includes('@')) {
    throw new Error('邮箱格式看起来不太对')
  }
  return { ok: true, email }
}

import { ActionStateDemo } from './components/ActionStateDemo'
import { Card } from './components/Card'
import { OptimisticDemo } from './components/OptimisticDemo'
import { RefAsPropDemo } from './components/RefAsPropDemo'
import { ThemeToggle } from './components/ThemeToggle'
import { TransitionDemo } from './components/TransitionDemo'
import { UseDemo } from './components/UseDemo'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* React 19：<title> / <meta> 可以直接写在组件里，会提升到 <head> */}
      <title>Lim Tools Web</title>
      <meta
        name="description"
        content="Lim Tools 前端：Vite + React 19 + Tailwind CSS v4"
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Lim Tools Web</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Vite 8 · React 19 · TypeScript 6 · Tailwind CSS v4 · React Compiler
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <Card
            title="ref 当普通 prop"
            api="ref"
            description="不再需要 forwardRef，直接声明 ref?: Ref<HTMLInputElement> 即可。"
          >
            <RefAsPropDemo />
          </Card>

          <Card
            title="表单 action + useActionState"
            api="useActionState"
            description="action 直接接 async 函数，pending 和返回值都由 React 托管。"
          >
            <ActionStateDemo />
          </Card>

          <Card
            title="乐观更新"
            api="useOptimistic"
            description="提交的瞬间就上屏，等真实结果回来再落定。"
          >
            <OptimisticDemo />
          </Card>

          <Card
            title="在渲染里读 Promise"
            api="use + Suspense"
            description="use() 读取 Promise，配合 Suspense 显示加载态。"
          >
            <UseDemo />
          </Card>

          <Card
            title="不阻塞输入的重活"
            api="useTransition + useDeferredValue"
            description="生成大列表放进 transition，筛选走延后的值。"
          >
            <TransitionDemo />
          </Card>

          <Card
            title="React Compiler"
            api="compiler: true"
            description="构建期自动记忆化，上面这些组件一行 useMemo / useCallback 都没写。"
          >
            <ul className="flex flex-col gap-1.5 text-slate-600 dark:text-slate-300">
              <li>· 组件与 Hook 的依赖由编译器推导，不再是手工维护</li>
              <li>· 关闭开关只需把 vite.config.ts 里的 compiler 改为 false</li>
              <li>· 违反 Hook 规则的写法会在构建时报错，而不是静默失效</li>
            </ul>
          </Card>
        </div>

        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
          聚合仓库：
          <a
            className="text-sky-600 hover:underline dark:text-sky-400"
            href="https://github.com/limnova/lim-tools-group"
            target="_blank"
            rel="noreferrer"
          >
            lim-tools-group
          </a>
        </footer>
      </main>
    </div>
  )
}

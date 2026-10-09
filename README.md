# Lim Tools Web

Lim Tools 前端。

## 技术栈

| | |
|---|---|
| 构建 | Vite 8 |
| 框架 | React 19(`use` / `useActionState` / `useOptimistic` / ref as prop) |
| 语言 | TypeScript 6 |
| 样式 | Tailwind CSS v4(`@tailwindcss/vite` 插件，无需 postcss 配置) |
| 编译 | React Compiler（构建期自动记忆化） |
| 包管理 | pnpm |
| Lint | oxlint |

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # tsc -b && vite build
pnpm preview    # 预览构建产物
pnpm lint       # oxlint
```

## 目录结构

```
src/
├── App.tsx                    # 页面骨架，演示卡片都在这里挂载
├── main.tsx                   # 入口
├── index.css                  # Tailwind 入口 + 主题变量
├── lib/api.ts                 # 假的异步接口，供演示用
└── components/
    ├── Card.tsx               # 卡片外壳 + 共用 class
    ├── ThemeToggle.tsx        # 明暗主题切换（class 策略）
    ├── SearchInput.tsx        # 演示 ref as prop
    ├── RefAsPropDemo.tsx
    ├── ActionStateDemo.tsx    # useActionState
    ├── OptimisticDemo.tsx     # useOptimistic
    ├── UseDemo.tsx            # use() + Suspense
    └── TransitionDemo.tsx     # useTransition + useDeferredValue
```

## 说明

- **React Compiler** 通过 `vite.config.ts` 里的 `react({ compiler: true })` 开启，
  依赖 `oxc-transform-react`。业务代码里不必再手写 `useMemo` / `useCallback`。
- **Tailwind v4** 用 `@import 'tailwindcss'` 引入，主题变量写在 `src/index.css` 的
  `@theme` 里；暗色模式通过 `@custom-variant dark` 改成 class 策略，由
  `ThemeToggle` 切换 `<html class="dark">`。
- `src/App.tsx` 里演示的 React 19 特性只是脚手架样例，接入真实业务时可以直接删。

## 所属聚合仓库

本仓库作为子模块挂载在 [lim-tools-group](https://github.com/limnova/lim-tools-group) 下，
由聚合仓库记录具体 commit。

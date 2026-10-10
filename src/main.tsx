import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.tsx'
import { theme } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* antd inserts a space between two-character Chinese labels ("数据" →
        "数 据"), which changes both the rendered text and the accessible name.
        The design and the browser tests both expect the label verbatim. */}
    <ConfigProvider locale={zhCN} theme={theme} button={{ autoInsertSpace: false }}>
      {/* component={false} keeps React 19's root free of a wrapper div, so the
          full-height layouts in index.css still measure against <body>. */}
      <AntdApp component={false}>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)

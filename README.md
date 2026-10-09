# Lim Tools Web

Lim 在线表格前端，基于 Vite + React 19 + TypeScript + Tailwind CSS v4。
使用 Univer 1.0.3 开源编辑内核，提供中文网格、公式、格式、工作表管理、筛选排序和查找替换。
产品范围、技术选型和后续评论 / 协作路线见聚合仓库的 [实施方案](../docs/spreadsheet-plan.md)。

## 本地运行

需要 Node.js 22.12+、pnpm 11 和 Go 1.26+。

先启动服务端：

```powershell
cd ../lim-tools-server
go run ./cmd/server
```

在另一个终端启动前端：

```powershell
cd lim-tools-web
pnpm install
pnpm dev --host 127.0.0.1
```

打开 `http://127.0.0.1:5173`，新建空白表格或项目预算示例。
Vite 将 `/api` 代理到 `http://127.0.0.1:8080`；不同后端地址可设置环境变量：

```powershell
$env:LIM_TOOLS_API_TARGET = 'http://127.0.0.1:8081'
pnpm dev --host 127.0.0.1
```

工作簿地址为 `/#/workbooks/<id>`，可以直接再次打开。
编辑器按需加载，文件列表不加载完整表格内核。首次打开会等待编辑器插件准备完成。

## 使用

- 双击单元格或直接输入；按 Enter 提交；以 `=` 开头输入公式。
- 工具栏设置字体、字号、颜色、对齐、边框、合并及数字格式；右键行列标题管理行列。
- 「数据」菜单对当前选区按首列排序或开启筛选。排序范围不含标题行，筛选范围包含标题行。
- 底部「+」添加工作表，右键标签重命名、复制或删除。
- 编辑结束后约 900 ms 自动保存；「保存」或 Ctrl / ⌘ + S 立即保存。
- 保存失败会显示错误并保留页面内容；重试继续保存。关闭 / 刷新 / 返回列表时会保护未保存修改。
- 两个页面写同一份文件时，旧版本会显示冲突，不覆盖最新数据。可以下载备份或另存副本。

## 文件交换

- CSV 导入会新建文件，支持 UTF-8、BOM、逗号、引号及多行文本。保留前导零和超出安全整数范围的数字文本；类似公式的文本按文本导入。
- CSV 导出当前工作表的已用范围和计算结果，不保留样式或公式。可能被 Excel 解释成公式的文本会加保护前缀。
- JSON 备份包含所有工作表、公式、样式和插件资源；导入时创建新的文件 ID。
- 导入文件最大 9 MB，API 请求最大 10 MB；最多 100 张工作表，每表 100,000 行 / 1,024 列，总计 200,000 个已存单元格。CSV 导出已用矩形范围也有 200,000 格限制。
- 原生 `.xlsx` 文件交换安排在后续阶段。

## 验证

```powershell
pnpm build
pnpm lint
pnpm test
```

浏览器测试需真实 Go 服务与 Vite 同时运行，测试只删除自己创建的文件：

```powershell
uv run --with playwright python -m playwright install chromium
uv run --with playwright python tests/browser_smoke.py
uv run --with playwright python tests/browser_pointer.py
```

其他端口添加 `--url http://127.0.0.1:5179`。验证覆盖编辑、公式、样式、复制粘贴、撤销重做、
合并、工作表管理、筛选排序、查找替换、刷新保存、CSV/JSON、保存中继续修改、失败重试、
跨页面冲突、未保存导航和窄屏布局。截图 / 下载文件写入已忽略的 `tests/artifacts/`。

## 运行与扩展

首版是一个共享工作区，服务端文件存储需要单实例独占持久目录；没有登录、用户隔离或实时协作。
正式使用前应按实施方案接入身份、文件权限与持久数据库。当前服务不访问已有 MongoDB 或 PostgreSQL 环境。
部署时用 `pnpm build` 生成静态文件，将前端与 `/api` 放在同域反向代理后，给服务端挂载持久目录并备份。
`pnpm preview` 仅预览静态文件，不提供生产 API 代理。

Univer 包固定同一版本；`pnpm-workspace.yaml` 明确跳过无需运行的 protobufjs 版本检查脚本。
React Compiler 在 `vite.config.ts` 开启，`oxc-transform-react` 版本与 Vite React 插件的 peer 范围保持一致。

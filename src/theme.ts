import type { ThemeConfig } from 'antd'

/**
 * Maps the palette the hand-written CSS established onto antd tokens, so
 * components keep the existing look instead of adopting antd's blue default.
 * Values are the ones index.css and Spreadsheet.tsx already use.
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1b6b54',
    colorText: '#142334',
    colorTextSecondary: '#64748b',
    colorBgLayout: '#f5f7fa',
    colorBgContainer: '#ffffff',
    colorBorder: '#dce2e8',
    colorBorderSecondary: '#e4e9ef',
    colorError: '#c13d3d',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    // .editor-header sits at z-index 1100 to clear Univer's canvas overlays
    // (its in-sheet menus reach 1090), and the sheet itself uses up to 1420.
    // antd's popup base defaults to 1000 — Modal lands on exactly 1000 and
    // Dropdown on 1050 — so both would render underneath the editor chrome.
    // Replacing the native <dialog> (which lived in the browser top layer)
    // with Modal makes this a real regression unless the base is raised.
    zIndexPopupBase: 1500,
  },
}

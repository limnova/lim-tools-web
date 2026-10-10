import type { ReactNode } from 'react'
import { Modal } from 'antd'

/**
 * Thin wrapper over antd Modal. Call sites mount it only while it should be
 * visible, so `open` is always true; the action buttons stay in the children
 * (see .dialog-actions) rather than in Modal's footer.
 */
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <Modal open title={title} onCancel={onClose} footer={null} centered>
    {children}
  </Modal>
}

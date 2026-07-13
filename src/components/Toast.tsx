import { AlertCircle, CheckCircle2, Clipboard, X } from "lucide-react";
import type { ReactElement } from "react";
import type { ToastState } from "../ui-types";

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

function ToastIcon({ kind }: Pick<ToastState, "kind">): ReactElement {
  if (kind === "success") return <CheckCircle2 size={16} />;
  if (kind === "error") return <AlertCircle size={16} />;
  return <Clipboard size={16} />;
}

/**
 * 展示操作反馈。
 *
 * @param props 提示内容与关闭回调。
 * @returns 固定在窗口底部居中的深色提示胶囊。
 */
export function Toast({ toast, onClose }: ToastProps): ReactElement {
  return (
    <div className="toast" role="status">
      <span className={`toast-icon ${toast.kind}`}><ToastIcon kind={toast.kind} /></span>
      <span>{toast.message}</span>
      <button type="button" className="toast-close" title="关闭" onClick={onClose}>
        <X size={13} />
      </button>
    </div>
  );
}

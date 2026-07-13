import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { useI18n } from "../i18n";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 应用内确认弹窗，替代系统原生 confirm。
 *
 * Escape 或点击遮罩视为取消；确认按钮默认聚焦，危险操作使用红色主按钮。
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  const { m } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelText = cancelLabel ?? m.confirm.cancel;

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className="editor-layer"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      style={{ zIndex: 85 }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <button type="button" className="editor-scrim" aria-label={cancelText} onClick={onCancel} />
      <div className="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-foot">
          <button type="button" className="btn-ghost" onClick={onCancel}>{cancelText}</button>
          <button
            type="button"
            ref={confirmRef}
            className={danger ? "btn-danger" : "btn-accent"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

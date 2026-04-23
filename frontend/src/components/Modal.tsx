import type { PropsWithChildren, ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  tone?: "default" | "celebration";
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, tone = "default", footer, children }: PropsWithChildren<ModalProps>) {
  if (!open) return null;
  return (
    <div className={`modal-backdrop modal-backdrop--${tone}`} onClick={onClose}>
      <div className={`modal-card modal-card--${tone}`} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          Close
        </button>
        {title ? <h2 className="modal-title">{title}</h2> : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}


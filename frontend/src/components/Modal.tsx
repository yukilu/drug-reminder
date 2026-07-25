import { ReactNode } from 'react';

interface Props {
  visible: boolean;
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  closable?: boolean;
}

export default function Modal({ visible, title, onClose, children, closable = true }: Props) {
  if (!visible) return null;
  return (
    <div
      className="modal-mask"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal">
        {title && (
          <div className="modal-header">
            <h3>{title}</h3>
            {closable && (
              <span className="modal-close" onClick={onClose}>
                ×
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

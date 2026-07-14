import type { ReactNode } from 'react';
import './ColaboradorModals.css';

type ModalShellProps = {
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export default function ModalShell({ onClose, children, className = '' }: ModalShellProps) {
  return (
    <div className="colab-modal-overlay" onClick={onClose}>
      <div
        className={`colab-modal ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

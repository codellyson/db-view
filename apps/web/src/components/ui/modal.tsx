import React from 'react';
import { Modal as JustModal } from '@codellyson/justui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  preventClose?: boolean;
  /** Content width in px. JustUI sets width inline, so max-w-* classes can't
   *  reach it — pass the number instead. */
  width?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  preventClose = false,
  width = 448,
}) => (
  <JustModal
    opened={isOpen}
    onClose={onClose}
    title={title}
    width={`min(${width}px, 92vw)`}
    withCloseButton={!preventClose}
    closeOnClickOutside={!preventClose}
    closeOnEscape={!preventClose}
    contentScrollable
    className={className}
  >
    {children}
  </JustModal>
);

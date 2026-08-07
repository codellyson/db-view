import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, cn } from '@codellyson/justui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  preventClose?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  preventClose = false,
}) => {
  const block = (e: Event) => {
    if (preventClose) e.preventDefault();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !preventClose) onClose();
      }}
    >
      <DialogContent
        className={cn('max-w-md gap-0 p-0', preventClose && '[&>button]:hidden', className)}
        onEscapeKeyDown={block}
        onPointerDownOutside={block}
        onInteractOutside={block}
        aria-describedby={undefined}
      >
        {title ? (
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-base font-semibold text-primary">{title}</DialogTitle>
          </DialogHeader>
        ) : (
          // Radix requires a title for the accessible name even when the
          // design doesn't show one.
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        )}
        <div className="p-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

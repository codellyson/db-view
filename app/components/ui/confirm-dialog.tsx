"use client";

import React from "react";
import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  variant?: "danger" | "primary";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "CONFIRM",
  message,
  confirmText = "DELETE",
  variant = "danger",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm font-mono uppercase mb-8">{message}</p>
      <div className="flex items-center justify-end gap-4">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          CANCEL
        </Button>
        <Button variant={variant} size="sm" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

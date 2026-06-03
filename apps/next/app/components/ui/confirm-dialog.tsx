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
  title = "Confirm",
  message,
  confirmText = "Delete",
  variant = "danger",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-secondary mb-6">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={variant} size="sm" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

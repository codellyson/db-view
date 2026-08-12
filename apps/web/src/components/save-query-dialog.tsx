
import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from '@codellyson/justui/react';

interface SaveQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, tags: string[]) => void;
  query: string;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  query,
}) => {
  const [name, setName] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave(name, tags);
    setName("");
    setTagsInput("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save query">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Name
          </label>
          <Input
            value={name}
            onChange={setName}
            placeholder="My query"
            containerClassName="w-full"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Tags (comma-separated)
          </label>
          <Input
            value={tagsInput}
            onChange={setTagsInput}
            placeholder="analytics, users, report"
            containerClassName="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Query
          </label>
          <pre className="px-3 py-2 text-xs font-mono text-secondary bg-bg-secondary border border-border rounded-md overflow-auto max-h-32 whitespace-pre-wrap">
            {query.length > 300 ? query.substring(0, 300) + "..." : query}
          </pre>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

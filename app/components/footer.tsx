import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-bg px-4 py-2">
      <div className="text-center">
        <span className="text-xs text-muted">
          Built by{' '}
          <a
            href="https://kreativekorna.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-accent transition-colors"
          >
            KreativeKorna Concepts
          </a>
        </span>
      </div>
    </footer>
  );
};

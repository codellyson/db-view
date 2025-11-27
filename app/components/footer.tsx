import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t-2 border-black bg-white p-4">
      <div className="text-center">
        <p className="text-xs font-mono text-black mb-1">
          CREATED BY
        </p>
        <a
          href="https://kreativekorna.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold uppercase text-black hover:underline inline-block"
        >
          KREATIVEKORNA CONCEPTS
        </a>
      </div>
    </footer>
  );
};


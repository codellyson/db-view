import React from 'react';
import { Button } from './ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  countIsEstimate?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  countIsEstimate = false,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between mt-8">
      <div className="text-sm font-bold uppercase text-black dark:text-white font-mono">
        SHOWING {startItem} TO {endItem} OF {countIsEstimate ? `~${totalItems.toLocaleString()} (ESTIMATED)` : totalItems.toLocaleString()} RESULTS
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
        >
          PREVIOUS
        </Button>
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-black dark:text-white font-bold" aria-hidden="true">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  aria-label={`Go to page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={`px-4 py-2 text-sm border-2 rounded-none font-mono font-bold uppercase ${
                    currentPage === page
                      ? 'bg-accent text-black border-accent'
                      : 'bg-white dark:bg-black text-black dark:text-white border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'
                  }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
        >
          NEXT
        </Button>
      </div>
    </nav>
  );
};


'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface MainContentProps {
  children: React.ReactNode;
}

export const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        prevPathname.current = pathname;
        setIsVisible(true);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <main
      className={`flex-1 bg-bg p-3 sm:p-4 md:p-6 overflow-auto transition-opacity duration-150 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </main>
  );
};

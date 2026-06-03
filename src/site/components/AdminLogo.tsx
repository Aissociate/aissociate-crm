// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AdminLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function AdminLogo({ src = '/logo.png', alt = 'Logo', className = 'h-16 w-auto object-contain' }: AdminLogoProps) {
  const [clickCount, setClickCount] = useState(0);
  const { adminMode, toggleAdminMode } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (clickCount === 5) {
      toggleAdminMode();
      setClickCount(0);
    }
  }, [clickCount, toggleAdminMode]);

  const handleClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setClickCount((prev) => prev + 1);

    timeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1500);
  };

  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        className={`${className} ${clickCount > 0 ? 'cursor-pointer' : ''} transition-transform ${
          clickCount > 0 ? 'scale-110' : ''
        }`}
        onClick={handleClick}
      />
      {adminMode && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
          ADMIN
        </div>
      )}
      {clickCount > 0 && clickCount < 5 && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          {clickCount}/5
        </div>
      )}
    </div>
  );
}

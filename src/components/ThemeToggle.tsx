import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
      aria-label="Basculer le thème"
      className={`rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg ${className ?? ''}`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

interface AdminLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

// Simple logo de la vitrine. (L'easter-egg « mode admin » a été retiré avec
// l'unification de l'auth : il pilotait des vues closer/fixer désormais supprimées.)
export default function AdminLogo({ src = '/logo.png', alt = 'Logo', className = 'h-16 w-auto object-contain' }: AdminLogoProps) {
  return <img src={src} alt={alt} className={className} />;
}

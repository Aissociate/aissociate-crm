// Capture en un clic de ce que voit l'utilisateur (sans la fenêtre de partage
// d'écran du navigateur) : la page est redessinée depuis le DOM.

/** Les éléments portant cet attribut sont exclus de la capture. */
export const IGNORER_CAPTURE = 'data-capture-ignore';
const ATTR_DEFILEMENT = 'data-capture-defilement';

/**
 * Le clone du DOM perd la position de défilement des zones scrollables :
 * on la note sur l'original puis on la rejoue en décalant les enfants du clone.
 */
function noterDefilements(): HTMLElement[] {
  const marques: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
    if (el.scrollTop > 0 || el.scrollLeft > 0) {
      el.setAttribute(ATTR_DEFILEMENT, `${el.scrollLeft},${el.scrollTop}`);
      marques.push(el);
    }
  });
  return marques;
}

function rejouerDefilement(clone: Node) {
  if (!(clone instanceof HTMLElement)) return;
  const valeur = clone.getAttribute(ATTR_DEFILEMENT);
  if (!valeur) return;
  clone.removeAttribute(ATTR_DEFILEMENT);
  const [x, y] = valeur.split(',').map(Number);
  clone.style.overflow = 'hidden';
  for (const enfant of Array.from(clone.children)) {
    if (enfant instanceof HTMLElement || enfant instanceof SVGElement) {
      const t = enfant.style.transform;
      enfant.style.transform = `translate(${-x}px, ${-y}px)${t && t !== 'none' ? ` ${t}` : ''}`;
    }
  }
}

/** Renvoie une image PNG de la fenêtre visible, ou null en cas d'échec. */
export async function capturerFenetre(): Promise<Blob | null> {
  const marques = noterDefilements();
  try {
    const { domToBlob } = await import('modern-screenshot');
    const fond = getComputedStyle(document.body).backgroundColor;
    const largeur = window.innerWidth;
    const hauteur = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const marge = getComputedStyle(document.body).margin;
    return await domToBlob(document.body, {
      width: largeur,
      height: hauteur,
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      backgroundColor: fond && fond !== 'rgba(0, 0, 0, 0)' ? fond : '#ffffff',
      timeout: 8000,
      type: 'image/png',
      // <noscript> (contenu SEO d'index.html) s'afficherait en clair dans le clone.
      filter: (n) => !(n instanceof Element && (n.hasAttribute(IGNORER_CAPTURE) || /^(NOSCRIPT|SCRIPT|TEMPLATE)$/.test(n.tagName))),
      onCloneEachNode: rejouerDefilement,
      onCloneNode: (clone) => {
        // Sans cela le clone reprend la marge par défaut de <body> (8 px) et tout est décalé.
        if (clone instanceof HTMLElement) clone.style.setProperty('margin', marge, 'important');
        // Page défilée au niveau de la fenêtre elle-même (pages sans zone scrollable interne).
        // `top` plutôt que `transform` : un transform ferait défiler aussi les éléments fixes (en-têtes).
        if ((scrollX || scrollY) && clone instanceof HTMLElement) {
          clone.style.position = 'relative';
          clone.style.top = `${-scrollY}px`;
          clone.style.left = `${-scrollX}px`;
        }
      },
    });
  } catch (e) {
    console.warn('Capture de la page impossible', e);
    return null;
  } finally {
    marques.forEach((el) => el.removeAttribute(ATTR_DEFILEMENT));
  }
}

/** Solution de repli : la fenêtre de partage d'écran du navigateur. */
export async function capturerViaPartage(): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true } as DisplayMediaStreamOptions);
    return await new Promise((resolve) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        void video.play();
        setTimeout(() => {
          const scale = Math.min(1, 1600 / video.videoWidth);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
          stream.getTracks().forEach((t) => t.stop());
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        }, 150);
      };
    });
  } catch {
    return null;
  }
}

// Nettoyage d'un document HTML d'agent dans le navigateur, avant de l'afficher, de
// l'imprimer (PDF) ou de l'exporter (Word). Double la barrière du serveur (html.ts) :
// aucun script, cadre, formulaire, attribut d'événement ni URL active ne passe.

const INTERDITES = 'script,iframe,frame,frameset,object,embed,applet,form,input,button,select,textarea,link,meta,base,noscript,template,svg,math';
const URL_ACTIVE = /^\s*(javascript|vbscript):/i;
const DATA_NON_IMAGE = /^\s*data:(?!image\/(png|jpe?g|gif|webp);)/i;

/** Renvoie le document nettoyé : les <style> puis le contenu du corps. */
export function htmlSur(brut: string): string {
  const doc = new DOMParser().parseFromString(brut || '', 'text/html');
  doc.querySelectorAll(INTERDITES).forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const { name, value } of [...el.attributes]) {
      const n = name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(name);
      else if (['href', 'src', 'action', 'formaction', 'xlink:href', 'srcset'].includes(n) && (URL_ACTIVE.test(value) || DATA_NON_IMAGE.test(value))) el.removeAttribute(name);
      else if (n === 'style' && /expression\s*\(|javascript:/i.test(value)) el.removeAttribute(name);
    }
  });
  const styles = [...doc.querySelectorAll('style')].map((st) => {
    st.textContent = (st.textContent ?? '').replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(/gi, '');
    const html = st.outerHTML;
    st.remove();
    return html;
  });
  return styles.join('\n') + doc.body.innerHTML;
}

/** Sépare les feuilles de style du contenu éditable. */
export function separer(html: string): { styles: string; corps: string } {
  const doc = new DOMParser().parseFromString(htmlSur(html), 'text/html');
  const styles = [...doc.querySelectorAll('style')].map((s) => s.outerHTML).join('\n');
  doc.querySelectorAll('style').forEach((s) => s.remove());
  return { styles, corps: doc.body.innerHTML };
}

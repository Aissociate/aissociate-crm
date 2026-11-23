# Iconographie

Aissociate utilise **Material Symbols, variante Sharp** (Google, licence Apache 2.0, gratuite pour un usage commercial).

## Pourquoi celle-ci

- **Angles droits** : la variante Sharp n'a ni coins ni extrémités arrondis, comme le reste de la marque (`rayon-0`).
- **Une seule source** : elle se charge depuis Google Fonts, comme Archivo et IBM Plex.
- **Réglable** : épaisseur, remplissage et taille optique se règlent sans changer de fichier, ce qui garde des icônes cohérentes du favicon à l'affiche.
- **Complète** : plus de 3 000 icônes, dont tout le vocabulaire de la formation, du travail et du numérique.

## Chargement

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<span class="material-symbols-sharp">school</span>
```

La famille est déclarée dans `tokens.json` sous le nom `icones`.

## Réglages

| Réglage | Valeur | Quand |
| --- | --- | --- |
| Épaisseur (`wght`) | 400 | Par défaut, à côté de texte en IBM Plex Sans |
| Épaisseur | 300 | Icônes de 40 px et plus |
| Remplissage (`FILL`) | 0 | Par défaut |
| Remplissage | 1 | État actif ou sélectionné seulement |
| Taille optique (`opsz`) | égale à la taille affichée | Toujours |
| Tailles | 20, 24, 32, 48 px | Sur la grille de 4 px |

## Couleur

- Par défaut, les icônes prennent la couleur `encre` ou `encre-douce` du texte voisin.
- `orange` seulement pour une icône de 24 px et plus qui porte l'action principale, ou pour l'icône d'une branche.
- `orange-texte` pour une petite icône active.
- Jamais d'icône multicolore, jamais d'icône sur une pastille de couleur décorative.

## Les icônes des branches

| Branche | Icône | Nom |
| --- | --- | --- |
| Studio IA | robot | `smart_toy` |
| Formation | toque de diplômé | `school` |
| Développement | balises de code | `code` |

## Vocabulaire courant

`groups` (les équipes), `handshake` (l'accompagnement), `schedule` (le temps gagné), `calendar_month` (les sessions), `euro` (le financement), `verified` (la certification Qualiopi), `description` (les devis et documents), `forum` (l'assistant conversationnel), `support_agent` (le service client), `trending_up` (les résultats), `location_on` (La Réunion), `mail`, `call`.

## Ce qu'on ne fait pas

- Mélanger avec une autre famille d'icônes, ou avec les variantes Outlined et Rounded de Material Symbols.
- Remplacer une icône par un émoji.
- Utiliser une icône seule, sans texte, pour une action importante, sauf dans une barre d'outils où son sens est évident.

# Aissociate

Aissociate forme, conseille et développe en intelligence artificielle depuis Saint-Denis, à La Réunion. La marque se décline en trois branches : **Studio IA**, la plateforme d'agents IA, **Formation** et **Développement**.

Ce guide fixe le logo, la baseline, les couleurs, la typographie et les règles d'usage. Il fait foi pour tout support Aissociate : site, Studio IA, documents commerciaux, devis, présentations, réseaux sociaux.

## Le principe

Le nom contient déjà ce que fait l'entreprise : **AI**ssociate. Toute l'identité repose sur un geste unique : le « AI » est mis en avant par la graisse et par l'orange, le reste du mot reste sobre. L'orange est rare, et c'est ce qui le rend lisible.

## Le logo

### Construction

| Élément | Police | Graisse | Couleur (token) |
| --- | --- | --- | --- |
| « AI » | Archivo | 900 (Black) | `orange` |
| « ssociate » | Archivo | 400 (Regular) | `encre` |
| Approche | | −0,03 em | |

Le logo s'écrit toujours d'un seul tenant, sans espace ni parenthèse. Les styles `logo-ai` et `logo-ssociate` donnent les valeurs exactes.

### Les versions

1. **Famille** (version principale) : le logo, un filet vertical `orange`, puis les trois branches empilées en Archivo 800 (`logo-branche`). C'est la version de la marque mère : site institutionnel, couvertures, signatures de documents.
2. **Branche** : le logo, le filet, puis une seule branche. Chaque activité utilise la sienne : « AIssociate | Studio IA », « AIssociate | Formation », « AIssociate | Développement ».
3. **En ligne** : le logo suivi de la branche, sans filet, séparés d'un espace de 0,26 em. Pour les en-têtes de site et d'application.
4. **Empilée** : la branche en petit (`etiquette` ou 13 px en 800) au-dessus du logo. Pour les écrans de moins de 480 px de large, où la version en ligne ne tient pas.

### Le filet

Le filet vertical sépare la marque des branches. Épaisseur : 5 à 7 % de la taille du logo (5 px pour un logo de 92 px). Hauteur : celle du bloc de branches. Couleur : `orange`, toujours.

### Zone de protection et taille minimale

- Laisser autour du logo un espace vide au moins égal à la hauteur du « A ».
- Taille minimale du logo seul : 120 px de large à l'écran, 30 mm à l'impression.
- En dessous de 200 px de large, retirer la baseline et passer en version Branche ou En ligne.

### Fonds autorisés

| Fond | « AI » | « ssociate » et branches |
| --- | --- | --- |
| Blanc | `orange` | `encre` |
| `sable` | `orange`, logo d'au moins 64 px de haut (contraste 2,7:1) | `encre` |
| `taupe` | `orange` (clair, #F0823F) | blanc |
| `noir` | `orange` (clair, #F0823F) | blanc |

Le thème Taupe et le thème Sombre de ce guide appliquent ces couleurs automatiquement.

### Ce qu'on ne fait pas

- Pas de parenthèses : la version « A(I)ssociate » est abandonnée.
- Pas de « AI » dans une autre couleur que l'orange, ni de « ssociate » en gras.
- Pas d'orange ailleurs que sur « AI », sur le filet et sur le « IA » de Studio IA et de la baseline.
- Pas de logo complet sur un aplat orange : le « AI » y disparaît. Utiliser le monogramme.
- Pas de contour, d'ombre, de dégradé, de déformation ni de rotation.
- Pas de taupe moyen ou clair en fond : l'orange s'y fond. Le taupe de marque est #483C32.

## La baseline

**Des IA et des Hommes**

- Composition : Archivo, « IA » et « Hommes » en 800, le reste en 400. « IA » en `orange`, « Hommes » en `encre`.
- Taille : un tiers de la hauteur du logo (style `baseline`), alignée à gauche sous « AIssociate », à environ 0,2 fois la taille du logo en dessous.
- « Hommes » prend une majuscule : il désigne l'humanité, pas les seuls hommes.
- Elle accompagne la version Famille et les supports de la marque mère. Elle n'apparaît pas à côté d'une branche seule.

## Le nommage

- Dans le texte courant, on écrit **Aissociate**, avec une seule capitale. La graphie « AIssociate » appartient au logo.
- Les branches s'appellent **Studio IA**, **Formation** et **Développement**, avec une majuscule.
- On écrit **IA** en français dans tous les textes. « AI » n'existe que dans le logo.
- Le « IA » de Studio IA répond en miroir au « AI » du logo : c'est la seule autre place de l'orange dans un nom.

## Couleurs

Six rôles portent l'interface, déclinés en trois thèmes : **Clair** (par défaut), **Taupe** (supports de marque) et **Sombre** (Studio IA).

| Token | Rôle |
| --- | --- |
| `fond`, `fond-alt` | Fond de page et surfaces secondaires |
| `encre`, `encre-douce` | Texte principal et secondaire |
| `orange` | Couleur de marque, réservée aux éléments de 24 px et plus en gras |
| `orange-texte` | Orange lisible pour les petits textes |
| `filet` | Séparateurs |
| `sur-orange` | Texte posé sur un aplat orange |

S'y ajoutent trois valeurs fixes de marque : `taupe` (#483C32), `sable` (#F2ECE4) et `noir` (#0E0C0A).

**Règle de contraste.** L'orange #EA6A1E atteint 3,2:1 sur blanc et seulement 2,7:1 sur sable. C'est suffisant pour le logo en grand et les titres en gras sur blanc, insuffisant pour un texte courant. Sur sable, réserver l'orange au logo de grande taille. Pour tout texte de moins de 24 px, utiliser `orange-texte`. Sur taupe et sur noir, les thèmes passent automatiquement à l'orange clair.

## Typographie

| Famille | Police | Usage |
| --- | --- | --- |
| `display` | Archivo | Logo, titres |
| `texte` | IBM Plex Sans | Texte courant |
| `mono` | IBM Plex Mono | Étiquettes et surtitres, en capitales espacées |

Les trois polices sont gratuites, sur Google Fonts :

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
```

Les titres restent en Archivo 700 à 800, approche légèrement négative. Ne jamais composer un titre en Archivo 900 orange : cette combinaison est réservée au « AI ».

## Formes et espacements

- La marque est à **angles droits** (`rayon-0`). Seules exceptions : l'icône d'application (`rayon-icone`) et les pastilles ou boutons (`rayon-pilule`).
- Pas d'ombres ni de dégradés. La profondeur vient des aplats (`fond-alt`, `taupe`, `sable`).
- Espacements sur une base de 4 px : `espace-1` à `espace-16`.

## Le monogramme

« AI » seul, en Archivo 900 `orange`, sur un carré `taupe` ou `noir`. Il sert d'icône d'application, de favicon et d'avatar de réseaux sociaux. À 16 px, il reste lisible : c'est l'intérêt de n'avoir que deux lettres.

## Ton éditorial et iconographie

Deux sections complètent ce guide :

- **Ton éditorial** : quatre principes (l'humain d'abord, concret et chiffré, simple, proche et professionnel), un registre par branche, les mots à préférer et des exemples avant/après.
- **Iconographie** : Material Symbols Sharp, choisie pour ses angles droits, avec ses réglages, ses couleurs et l'icône de chaque branche.

## Ce qui reste à produire

- **Fichiers vectoriels du logo** (SVG, PDF) aux tracés vectorisés. Ce guide compose le logo en texte Archivo ; un fichier destiné à un imprimeur doit avoir ses lettres converties en tracés.

/**
 * Faux client Supabase en mémoire pour tester les outils de l'agent sans base :
 * from(table).select / insert / update / delete, filtres eq / is / in / not /
 * ilike / or, order / limit, single / maybeSingle, et `count` en mode head.
 * Ne couvre que ce dont les tests ont besoin.
 */
type Ligne = Record<string, unknown>;
type Filtre = (l: Ligne) => boolean;

export type FauxDb = {
  tables: Record<string, Ligne[]>;
  journal: { op: string; table: string; valeurs?: unknown }[];
  from: (table: string) => Requete;
  auth: { getUser: () => Promise<{ data: { user: { id: string } } }> };
};

type Resultat = { data: unknown; error: { message: string } | null; count?: number | null };

class Requete implements PromiseLike<Resultat> {
  private filtres: Filtre[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private valeurs: Ligne | Ligne[] | null = null;
  private compte = false;
  private tete = false;
  private unique: 'single' | 'maybe' | null = null;
  private max: number | null = null;

  constructor(private db: FauxDb, private table: string) {}

  private lignes(): Ligne[] { return (this.db.tables[this.table] ??= []); }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select' && opts?.count) { this.compte = true; this.tete = Boolean(opts.head); }
    return this;
  }
  insert(v: Ligne | Ligne[]) { this.op = 'insert'; this.valeurs = v; return this; }
  update(v: Ligne) { this.op = 'update'; this.valeurs = v; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(v: Ligne | Ligne[]) { return this.insert(v); }

  eq(c: string, v: unknown) { this.filtres.push((l) => l[c] === v); return this; }
  neq(c: string, v: unknown) { this.filtres.push((l) => l[c] !== v); return this; }
  is(c: string, v: unknown) { this.filtres.push((l) => (l[c] ?? null) === v); return this; }
  in(c: string, vs: unknown[]) { this.filtres.push((l) => vs.includes(l[c])); return this; }
  not(c: string, _op: string, v: unknown) { this.filtres.push((l) => (l[c] ?? null) !== v); return this; }
  ilike(c: string, motif: string) {
    const re = new RegExp(`^${motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
    this.filtres.push((l) => re.test(String(l[c] ?? '')));
    return this;
  }
  or() { return this; }
  gte() { return this; }
  lt() { return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.unique = 'single'; return this; }
  maybeSingle() { this.unique = 'maybe'; return this; }

  private executer(): Resultat {
    const vise = this.lignes().filter((l) => this.filtres.every((f) => f(l)));
    if (this.op === 'insert') {
      const nouvelles = (Array.isArray(this.valeurs) ? this.valeurs : [this.valeurs!])
        .map((v) => ({ id: `${this.table}-${this.lignes().length + 1}`, ...v }));
      this.lignes().push(...nouvelles);
      this.db.journal.push({ op: 'insert', table: this.table, valeurs: nouvelles });
      return this.forme(nouvelles);
    }
    if (this.op === 'update') {
      for (const l of vise) Object.assign(l, this.valeurs);
      this.db.journal.push({ op: 'update', table: this.table, valeurs: this.valeurs });
      return this.forme(vise);
    }
    if (this.op === 'delete') {
      this.db.tables[this.table] = this.lignes().filter((l) => !vise.includes(l));
      this.db.journal.push({ op: 'delete', table: this.table, valeurs: vise.map((l) => l.id) });
      return { data: null, error: null };
    }
    if (this.compte && this.tete) return { data: null, error: null, count: vise.length };
    return this.forme(this.max != null ? vise.slice(0, this.max) : vise);
  }

  private forme(lignes: Ligne[]): Resultat {
    if (this.unique === 'single') {
      return lignes.length === 1 ? { data: lignes[0], error: null } : { data: null, error: { message: 'Ligne introuvable' } };
    }
    if (this.unique === 'maybe') return { data: lignes[0] ?? null, error: null };
    return { data: lignes, error: null };
  }

  then<A = Resultat, B = never>(ok?: ((r: Resultat) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.executer()).then(ok, ko);
  }
}

export function fauxDb(tables: Record<string, Ligne[]> = {}): FauxDb {
  const db: FauxDb = {
    tables: structuredClone(tables),
    journal: [],
    from: (table: string) => new Requete(db, table),
    auth: { getUser: async () => ({ data: { user: { id: 'moi' } } }) },
  };
  return db;
}

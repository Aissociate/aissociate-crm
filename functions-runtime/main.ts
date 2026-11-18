// Lanceur maison des fonctions serveur (ex-Supabase Edge Functions).
// Le code de supabase/functions/<nom>/index.ts tourne tel quel : chaque
// fonction appelle Deno.serve(handler) ; on intercepte cet appel pour
// récupérer son handler, puis un seul serveur HTTP route /<nom>/… vers lui.
// Les fonctions sont chargées à la première requête (démarrage rapide, et une
// fonction cassée ne bloque pas les autres).
type Handler = (req: Request, info?: unknown) => Response | Promise<Response>;

const ROOT = Deno.env.get("FUNCTIONS_DIR") ?? "/app/functions";
const PORT = Number(Deno.env.get("PORT") ?? 8000);
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

// Travail en arrière-plan après la réponse (API du runtime Supabase).
(globalThis as Record<string, unknown>).EdgeRuntime = {
  waitUntil(p: Promise<unknown>) {
    Promise.resolve(p).catch((e) => console.error("[waitUntil]", e?.message ?? e));
  },
};

const available = new Set<string>();
for await (const entry of Deno.readDir(ROOT)) {
  if (!entry.isDirectory || !NAME_RE.test(entry.name)) continue;
  try {
    await Deno.stat(`${ROOT}/${entry.name}/index.ts`);
    available.add(entry.name);
  } catch { /* pas un point d'entrée */ }
}

const realServe = Deno.serve;
const handlers = new Map<string, Promise<Handler>>();
let queue: Promise<unknown> = Promise.resolve();

/** Importe une fonction en capturant le handler passé à Deno.serve (un import à la fois). */
function load(name: string): Promise<Handler> {
  let h = handlers.get(name);
  if (!h) {
    h = queue.then(async () => {
      let captured: Handler | undefined;
      // deno-lint-ignore no-explicit-any
      (Deno as any).serve = (...args: any[]) => {
        captured = args.find((a) => typeof a === "function") ?? args[0]?.handler ?? args[1]?.handler;
        return { finished: new Promise(() => {}), shutdown: async () => {}, ref() {}, unref() {}, addr: { transport: "tcp", hostname: "0.0.0.0", port: PORT } };
      };
      try {
        await import(`file://${ROOT}/${name}/index.ts`);
      } finally {
        // deno-lint-ignore no-explicit-any
        (Deno as any).serve = realServe;
      }
      if (!captured) throw new Error(`La fonction ${name} n'a pas appelé Deno.serve`);
      console.log(`[runtime] fonction chargée : ${name}`);
      return captured;
    });
    queue = h.catch(() => {});
    handlers.set(name, h);
    // Un échec de chargement n'est pas mis en cache : la requête suivante réessaie.
    h.catch(() => handlers.delete(name));
  }
  return h;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

realServe({ port: PORT, hostname: "0.0.0.0", onListen: () => console.log(`[runtime] ${available.size} fonctions disponibles, port ${PORT}`) }, async (req, info) => {
  const url = new URL(req.url);
  if (url.pathname === "/_health") return json(200, { ok: true, functions: available.size, loaded: handlers.size });
  // Contrôle après déploiement : charge toutes les fonctions et liste celles qui échouent.
  if (url.pathname === "/_preload") {
    const failed: Record<string, string> = {};
    for (const n of [...available].sort()) {
      try { await load(n); } catch (e) { failed[n] = String((e as Error)?.message ?? e).slice(0, 200); }
    }
    return json(Object.keys(failed).length ? 500 : 200, { loaded: available.size - Object.keys(failed).length, failed });
  }
  const name = url.pathname.split("/")[1] ?? "";
  if (!available.has(name)) return json(404, { code: "NOT_FOUND", message: "Requested function was not found" });
  try {
    const handler = await load(name);
    return await handler(req, info);
  } catch (err) {
    console.error(`[runtime] ${name} :`, err instanceof Error ? err.stack ?? err.message : err);
    return json(500, { code: "FUNCTION_ERROR", message: "La fonction a échoué" });
  }
});

// Une promesse rejetée oubliée dans une fonction ne doit pas arrêter les autres.
globalThis.addEventListener("unhandledrejection", (e) => {
  console.error("[runtime] rejet non géré :", (e.reason as Error)?.message ?? e.reason);
  e.preventDefault();
});

import { describe, expect, it } from "vitest";
import { analyserFlux, decouvrirFlux, texteArticle, urlPublique } from "./veille.ts";
import { construireMimeHtml, contactsValides, markdownVersHtml, nettoyerListes, personnaliser } from "./mailing.ts";
import { apercuAction, modifierAction, titreAction, type ActionLivrable } from "./outils.ts";

describe("veille — adresses", () => {
  it("n'accepte que des adresses publiques", () => {
    expect(urlPublique("https://www.lemonde.fr/rss/une.xml#x")).toBe("https://www.lemonde.fr/rss/une.xml");
    for (const u of ["http://localhost/rss", "http://127.0.0.1/x", "http://10.0.0.2/", "http://192.168.1.1/", "http://169.254.169.254/latest",
      "file:///etc/passwd", "https://user:pw@site.fr/", "https://site.fr:8080/", "http://[::1]/", "http://intranet/"]) {
      expect(urlPublique(u)).toBeNull();
    }
  });
});

describe("veille — flux", () => {
  it("lit un flux RSS 2.0", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Actu &amp; IA</title><link>https://actu.fr</link>
      <item><title><![CDATA[OpenAI lance <b>X</b>]]></title><link>https://actu.fr/a1</link><guid>a1</guid>
      <description>&lt;p&gt;Résumé &eacute;tendu&lt;/p&gt;</description><pubDate>Tue, 17 Nov 2026 08:00:00 GMT</pubDate></item>
      <item><title>Deux</title><link>https://actu.fr/a2</link></item></channel></rss>`;
    const f = analyserFlux(xml)!;
    expect(f.titre).toBe("Actu & IA");
    expect(f.site).toBe("https://actu.fr");
    expect(f.articles).toHaveLength(2);
    expect(f.articles[0]).toMatchObject({ guid: "a1", titre: "OpenAI lance X", lien: "https://actu.fr/a1", resume: "Résumé étendu", date: "2026-11-17T08:00:00.000Z" });
    expect(f.articles[1].guid).toBe("https://actu.fr/a2");
  });
  it("lit un flux Atom", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title><link rel="alternate" href="https://b.fr"/>
      <entry><title>Billet</title><link rel="alternate" href="https://b.fr/1"/><id>tag:b,1</id><updated>2026-11-16T10:00:00Z</updated><summary>Court</summary></entry></feed>`;
    const f = analyserFlux(xml)!;
    expect(f.site).toBe("https://b.fr");
    expect(f.articles[0]).toMatchObject({ guid: "tag:b,1", lien: "https://b.fr/1", resume: "Court" });
  });
  it("refuse ce qui n'est pas un flux, découvre le flux d'un site", () => {
    expect(analyserFlux("<html><body>x</body></html>")).toBeNull();
    const html = `<head><link rel="alternate" type="application/rss+xml" title="RSS" href="/feed/"></head>`;
    expect(decouvrirFlux(html, "https://site.fr/blog/")).toBe("https://site.fr/feed/");
    expect(decouvrirFlux("<head></head>", "https://site.fr")).toBeNull();
  });
  it("extrait le texte d'un article", () => {
    const t = texteArticle("<title>T</title><nav>menu</nav><article><h1>Titre</h1><p>Un <b>texte</b>.</p><script>x()</script></article><footer>pied</footer>");
    expect(t.titre).toBe("T");
    expect(t.texte).toBe("Titre\nUn texte .");
  });
});

describe("mailing", () => {
  it("convertit le markdown en HTML d'e-mail sûr", () => {
    const h = markdownVersHtml("# Titre\n\nBonjour **Marie**, voir [ici](https://a.fr).\n\n- un\n- deux\n\n<script>x</script>");
    expect(h).toContain("<h1");
    expect(h).toContain("<strong>Marie</strong>");
    expect(h).toContain('<a href="https://a.fr"');
    expect(h).toContain("<li style=\"margin:0 0 6px\">un</li>");
    expect(h).not.toContain("<script>");
    expect(markdownVersHtml("[x](javascript:alert(1))")).not.toContain("href");
  });
  it("personnalise et nettoie", () => {
    expect(personnaliser("Bonjour {{prenom}},", { prenom: "Léa" })).toBe("Bonjour Léa,");
    expect(personnaliser("Bonjour {{ prenom }},", { prenom: null })).toBe("Bonjour,");
    expect(nettoyerListes("Clients, prospects,clients")).toEqual(["clients", "prospects"]);
  });
  it("valide les contacts importés", () => {
    const r = contactsValides([{ email: " A@B.fr ", prenom: "A" }, { email: "a@b.fr" }, { email: "faux" }, {}]);
    expect(r.contacts).toEqual([{ email: "a@b.fr", prenom: "A", nom: null }]);
    expect(r.rejets).toBe(3);
  });
  it("construit un message avec désinscription en un clic", () => {
    const m = construireMimeHtml({ a: "x@y.fr", objet: "Édition n°1", texte: "t", html: "<p>h</p>", desinscription: "https://d/1", desinscriptionDirecte: "https://f?desinscription=1" });
    expect(m).toMatch(/^To: x@y\.fr\r\nSubject: =\?UTF-8\?B\?/);
    expect(m).toContain("List-Unsubscribe: <https://f?desinscription=1>, <https://d/1>");
    expect(m).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(m).toContain("multipart/alternative");
  });
  it("livrable de mailing : titre, aperçu, modification", () => {
    const a: ActionLivrable = { type: "mailing_envoyer", objet: "News", contenu: "Bonjour", liste: "clients", destinataires: 12 };
    expect(titreAction(a)).toBe("Mailing — News");
    expect(apercuAction(a)).toContain("liste « clients » (12");
    expect(modifierAction(a, { objet: "Autre", contenu: "Texte" })).toMatchObject({ objet: "Autre", contenu: "Texte", liste: "clients" });
    expect(modifierAction(a, { objet: "", contenu: "x" })).toHaveProperty("erreur");
  });
});

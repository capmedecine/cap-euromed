# Site Cap EuroMed — notes de maintenance

Site statique bilingue (FR/EN) publié par **GitHub Pages**, qui le construit avec **Jekyll 3.10** à chaque push sur `main`.
Pas d'étape de build à lancer avant de publier : on modifie les sources, on pousse, GitHub construit.

## Structure
- `_layouts/base.html` : `<head>` SEO (title, description, canonical, hreflang, Open Graph), menu, pied de page, bouton WhatsApp flottant.
- `_includes/` : `nav.html`, `footer.html`, `lang-switch.html` (bouton FR/EN), `sprite.html` (icônes SVG),
  `cta-contact.html` (carte postale « Contact » en bas de page), `faq-page.html` (gabarit des pages FAQ),
  `guides-lies.html` (bloc « Pour aller plus loin », `id="guides"` : en FR, cartes vers les guides passés dans
  `slugs="slug1,slug2"` ; en EN, cartes fixes vers Our support / Team / FAQ). Utilisé sur les pages des facs et Accompagnement :
  penser à y ajouter les nouveaux guides pertinents (maillage interne vers et depuis les pages qui convertissent).
- `_data/i18n.yml` : textes d'interface FR/EN (menu, pied de page, liens WhatsApp, bloc contact `cta_*`, crédits photos).
- `_data/universites.yml` : cartes « Nos destinations » de la page d'accueil.
- `_data/guides_a_venir.yml` : guides annoncés « En cours de création » sur `/guides/` (sans page). Retirer le bloc quand le guide est publié.
- `_data/faq.yml` : questions/réponses de la page FAQ (FR et EN, mêmes groupes `id`). Les données structurées FAQPage en sont générées.
- Pages : `index.html` (accueil FR), `en/index.html` (accueil EN), `universites/<slug>/index.html` (FR), `en/universities/<slug>/index.html` (EN)
  — aujourd'hui `upjs-kosice` (médecine, dentaire) et `uvlf-kosice` (vétérinaire) —,
  `accompagnement/index.html` ↔ `en/support/index.html` (parcours en 5 étapes), `equipe/index.html` ↔ `en/team/index.html` (équipe),
  `faq/index.html` ↔ `en/faq/index.html` (FAQ), `espace-etudiant/index.html` ↔ `en/student-area/index.html`
  (« En construction », noindex, hors sitemap ; bouton « Espace étudiant » de l'en-tête, lien `student_url` dans `_data/i18n.yml`),
  `404.html`, `sitemap.xml` (généré).
  L'accompagnement, l'équipe et la FAQ ne sont plus sur l'accueil ; les anciennes ancres `/#accompagnement`, `/#equipe` et `/#faq`
  sont redirigées par `site.js`. Les pages d'université gardent leur propre section « Accompagnement » (pages d'arrivée des pubs).
- Menu : `nav` dans `_data/i18n.yml`. Une entrée avec `children` (label, note, href) devient un menu déroulant (« Universités »).
- Vocabulaire : parler de « concours français » (PASS, LAS, concours véto), jamais de « numerus clausus ». Ne pas écrire
  « sans concours » tout court : les facs ont leur propre test d'entrée.
- `assets/css/site.css`, `assets/js/site.js` : styles et interactions communs. Après modification, incrémenter `asset_version` dans `_config.yml`.
- `_guides/` : collection d'articles (FR uniquement), publiés sous `/guides/<nom>/` avec le layout `_layouts/guide.html`
  (sommaire, FAQ, sources, données structurées Article). Index : `guides/index.html`.
- Espace étudiant (révision du test d'entrée) : page cachée `espace-etudiant/app/index.html` (layout `_layouts/espace.html`,
  `assets/js/espace.js`, `assets/css/espace.css`), comptes et données chez Supabase (`supabase_url` / `supabase_anon_key`
  dans `_config.yml`). Structure SQL et mode d'emploi : `_supabase/`. La banque de questions de l'UPJŠ ne doit jamais
  être commitée (dépôt public) : elle s'importe à part dans Supabase.
- `_brouillons/` : non publié (Jekyll ignore les dossiers en `_`). Contient la page mentions légales en attente des infos de l'éditeur.

## Notes de travail (non publiées)
- `.claude/notes/plan-reseaux-sociaux.md` : plan réseaux sociaux mis de côté. Le ressortir dès que l'utilisateur parle de
  création de contenu, de réseaux sociaux, de TikTok/Instagram/YouTube ou de vidéos.

## Front matter d'une page
`layout: base`, `lang: fr|en`, `alt_url` (page équivalente dans l'autre langue, sert au bouton FR/EN et aux hreflang),
`title` (≤ 60 caractères), `description` (≤ 155), `sitemap: true`, `priority`, et optionnellement `og_title`, `og_description`, `og_image`,
`wa_short` / `wa_long` (message WhatsApp pré-rempli spécifique à la page), `robots`, `verification: true` (accueil FR uniquement).

## Ajouter une université
1. Copier `universites/upjs-kosice/` vers `universites/<slug>/` et `en/universities/upjs-kosice/` vers `en/universities/<slug>/`, puis réécrire le contenu.
2. Mettre `alt_url` croisés entre les deux pages.
3. Ajouter un bloc dans `_data/universites.yml` (photo WebP en 480 et 960 px dans `assets/img/`).
4. Ajouter l'université dans les `children` du menu « Universités » / « Universities » de `_data/i18n.yml` (FR et EN).
5. Le sitemap se met à jour tout seul (`sitemap: true`).

## Tester en local
```
GEM_HOME=<dossier> gem install jekyll -v 3.10.0 kramdown-parser-gfm
jekyll build -s . -d /tmp/_site   # puis servir /tmp/_site avec un serveur statique
```

## Règles de contenu
- Garder FR et EN alignés (mêmes sections, mêmes ancres `id`).
- Pas d'affirmation non vérifiée : diplôme reconnu via la directive 2005/36/CE, internat en France via EDN/ECOS ;
  frais « fixés chaque année par l'université » ; pas de mention « université partenaire ».
- Photos Wikimedia sous CC BY-SA : garder les crédits dans le pied de page.
- Mesure d'audience : renseigner `plausible_domain` dans `_config.yml` quand le compte Plausible existe (pas de cookies, pas de bandeau).

## Ajouter un guide
Créer `_guides/<slug>.html` avec en front matter : `title` (≤ 60), `description` (≤ 155), `h1`, `crumb`, `category`, `lead`,
`excerpt_text`, `date`, `last_modified_at`, `toc` (id + titre de chaque `<h2 id>`), `faq` (q/a), `sources` (title/url).
Le contenu commence par un encadré `<div class="answer">` (réponse directe), puis des `<h2 id>` correspondant au `toc`.
Ajouter des liens internes vers le guide depuis les pages concernées. Le menu « Guides » et le sitemap se mettent à jour seuls.

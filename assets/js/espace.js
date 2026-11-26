/* Espace étudiant Cap EuroMed : révision du test d'entrée de l'UPJŠ.
   Comptes et données : Supabase (structure dans _supabase/). Module ES chargé tel quel, sans build. */

const CFG = window.ESPACE_CONFIG || {};
const root = document.getElementById('espace');
const MATIERE = { id: 'chimie', nom: 'Chimie' };
const EXAMEN = { questions: 100, propositions: 4, minutes: 75, seuil: 75 };
const LETTRES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ROUTES = [
  ['accueil', 'Accueil'],
  ['entrainement', 'S’entraîner'],
  ['examen', 'Examen blanc'],
  ['a-revoir', 'À revoir'],
  ['suivi', 'Suivi des étudiants'],
];

let sb = null;
const st = { user: null, profil: null, questions: [], parId: new Map(), prog: new Map(), examens: [], charge: false, enCours: null, lien: null };
let serie = null;      // série d'entraînement en cours
let examen = null;     // examen blanc en cours
let resultat = null;   // dernier résultat d'examen affiché
let minuteur = null;
let confirmation = false;

/* ---------- Utilitaires ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const melange = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pourcent = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const bonnes = (q) => new Set(q.reponses.split(',').map((x) => x.trim()));
const chrono = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(r).padStart(2, '0'); };
const duree = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
const jour = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const memo = {
  lire(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  effacer(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};
const cleExamen = () => `cap-euromed-examen-${st.user?.id}`;
const prenom = () => {
  const n = (st.profil?.nom || st.user?.email?.split('@')[0] || '').trim();
  const p = n.split(/[\s._-]+/)[0] || '';
  return p.charAt(0).toUpperCase() + p.slice(1);
};

function afficher(html, haut = true) {
  root.innerHTML = html;
  if (haut) window.scrollTo(0, 0);
}
function message(texte, type = 'info') {
  let zone = document.getElementById('es-toast');
  if (!zone) { zone = document.createElement('div'); zone.id = 'es-toast'; zone.setAttribute('role', 'status'); document.body.append(zone); }
  zone.className = `es-toast ${type}`;
  zone.textContent = texte;
  zone.hidden = false;
  clearTimeout(message.t);
  message.t = setTimeout(() => { zone.hidden = true; }, 5000);
}

/* ---------- Statistiques ---------- */
function stats() {
  let vues = 0, maitrisees = 0, aRevoir = 0, semaine = 0;
  const depuis = Date.now() - 7 * 864e5;
  for (const [id, p] of st.prog) {
    if (!st.parId.has(id)) continue;
    if (p.tentatives > 0) vues++;
    if (p.dernier_juste) maitrisees++;
    if (p.a_revoir) aRevoir++;
    if (p.tentatives > 0 && new Date(p.premiere_fois).getTime() > depuis) semaine++;
  }
  return { total: st.questions.length, vues, maitrisees, aRevoir, semaine };
}
const idsARevoir = () => st.questions.filter((q) => st.prog.get(q.id)?.a_revoir).map((q) => q.id);

/* ---------- Démarrage et connexion ---------- */
async function demarrer() {
  if (!CFG.url || !CFG.key || !window.supabase) {
    afficher(seul(`<h1>Espace étudiant</h1><p>L'espace est en cours d'installation. Reviens un peu plus tard.</p>`));
    return;
  }
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (['invite', 'recovery'].includes(h.get('type'))) st.lien = h.get('type');
  const erreurLien = h.get('error_description');
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  sb.auth.onAuthStateChange((evt, session) => {
    const avant = st.user?.id;
    st.user = session?.user || null;
    setTimeout(() => {
      if (evt === 'PASSWORD_RECOVERY') { st.lien = 'recovery'; route(); }
      else if (evt === 'SIGNED_OUT') { reinitialiser(); route(); }
      else if (evt === 'SIGNED_IN' && avant !== st.user?.id) { st.charge = false; route(); }
    }, 0);
  });
  const { data } = await sb.auth.getSession();
  st.user = data.session?.user || null;
  if (erreurLien) {
    history.replaceState(null, '', location.pathname);
    message('Ce lien n’est plus valable. Demande un nouveau lien avec « Mot de passe oublié ».', 'erreur');
  }
  if (st.lien && !st.user) st.lien = null;
  window.addEventListener('hashchange', () => route());
  route();
}

function reinitialiser() {
  clearInterval(minuteur); minuteur = null;
  Object.assign(st, { user: null, profil: null, questions: [], parId: new Map(), prog: new Map(), examens: [], charge: false, enCours: null, lien: null });
  serie = null; examen = null; resultat = null;
}

async function charger() {
  if (st.enCours) return st.enCours;
  afficher('<div class="es-chargement" role="status"><span class="es-spin" aria-hidden="true"></span>Chargement de ta préparation…</div>');
  st.enCours = (async () => {
    const uid = st.user.id;
    const [p, q, g, x] = await Promise.all([
      sb.from('profils').select('id, email, nom, role').eq('id', uid).maybeSingle(),
      sb.from('questions').select('id, numero, enonce, a, b, c, d, e, f, g, h, reponses').eq('matiere', MATIERE.id).order('numero'),
      sb.from('progression').select('question_id, tentatives, reussites, dernier_juste, a_revoir, premiere_fois, mis_a_jour').eq('user_id', uid),
      sb.from('examens').select('id, matiere, score, score_max, duree_s, created_at').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    for (const r of [p, q, g, x]) if (r.error) throw r.error;
    st.profil = p.data;
    st.questions = q.data || [];
    st.parId = new Map(st.questions.map((r) => [r.id, r]));
    st.prog = new Map((g.data || []).map((r) => [r.question_id, r]));
    st.examens = x.data || [];
    st.charge = true;
    reprendreExamen();
  })();
  try { await st.enCours; route(); }
  catch (e) {
    afficher(seul(`<h1>Oups</h1><p>Impossible de charger ta préparation. Vérifie ta connexion, puis recharge la page.</p><p class="es-petit">${esc(e.message || e)}</p><button class="btn btn-ghost" data-action="deconnexion">Se déconnecter</button>`));
  } finally { st.enCours = null; }
}

function route() {
  if (!sb) return;
  if (st.lien && st.user) return vueNouveauMdp();
  if (!st.user) return vueConnexion();
  if (!st.charge) return charger();
  const r = location.hash.replace(/^#\/?/, '') || 'accueil';
  confirmation = false;
  if (r !== 'examen') resultat = null;
  if (r === 'entrainement') return serie ? vueSerie() : vueEntrainement();
  if (r === 'examen') return examen ? vueExamen() : resultat ? vueResultat() : vueExamenIntro();
  if (r === 'a-revoir') return vueARevoir();
  if (r === 'suivi' && st.profil?.role === 'admin') return vueSuivi();
  if (r === 'compte') return vueCompte();
  return vueAccueil();
}

/* ---------- Mise en page ---------- */
function seul(contenu) {
  return `<div class="es-seul"><a class="logo" href="/" aria-label="Cap EuroMed, retour au site"><span class="logo-mark" aria-hidden="true"></span>Cap EuroMed</a><div class="es-carte es-auth">${contenu}</div><p class="es-note">Cet espace est réservé aux étudiants accompagnés par Cap EuroMed. <a href="/espace-etudiant/">En savoir plus</a></p></div>`;
}
function cadre(actif, contenu) {
  const n = stats().aRevoir;
  const liens = ROUTES.filter(([r]) => r !== 'suivi' || st.profil?.role === 'admin')
    .map(([r, label]) => `<a href="#/${r}"${r === actif ? ' aria-current="page"' : ''}>${esc(label)}${r === 'a-revoir' && n ? ` <span class="es-pastille">${n}</span>` : ''}</a>`).join('');
  const bandeau = examen && actif !== 'examen'
    ? `<a class="es-bandeau" href="#/examen">Examen blanc en cours : il te reste ${chrono((examen.fin - Date.now()) / 1000)}. Reprendre</a>` : '';
  return `<header class="es-haut">
    <div class="es-haut-in">
      <a class="logo" href="/" aria-label="Cap EuroMed, retour au site"><span class="logo-mark" aria-hidden="true"></span>Cap EuroMed</a>
      <span class="es-badge">Espace étudiant</span>
      <div class="es-compte">
        <a class="es-lien-discret" href="#/compte">${esc(st.user?.email || '')}</a>
        <button class="btn btn-ghost btn-sm" type="button" data-action="deconnexion">Se déconnecter</button>
      </div>
    </div>
    <nav class="es-nav" aria-label="Espace étudiant"><div class="es-nav-in">${liens}</div></nav>
  </header>${bandeau}
  <main class="es-main${actif === 'suivi' ? ' large' : ''}" id="contenu">${contenu}</main>`;
}

/* ---------- Vues : connexion ---------- */
function vueConnexion() {
  afficher(seul(`<h1>Espace étudiant</h1>
    <p>Connecte-toi avec l'adresse e-mail de ton invitation.</p>
    <form data-form="connexion" class="es-form">
      <label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
      <label>Mot de passe<input type="password" name="mdp" autocomplete="current-password" required></label>
      <button class="btn btn-ink" type="submit">Se connecter</button>
    </form>
    <button class="es-lien" type="button" data-action="oubli">Mot de passe oublié&#8239;?</button>`));
}
function vueOubli() {
  afficher(seul(`<h1>Mot de passe oublié</h1>
    <p>Indique ton adresse e-mail : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
    <form data-form="oubli" class="es-form">
      <label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
      <button class="btn btn-ink" type="submit">Recevoir le lien</button>
    </form>
    <button class="es-lien" type="button" data-action="connexion">Retour à la connexion</button>`));
}
function vueNouveauMdp() {
  const titre = st.lien === 'invite' ? 'Bienvenue&#8239;! Choisis ton mot de passe' : 'Choisis un nouveau mot de passe';
  afficher(seul(`<h1>${titre}</h1>
    <p>Au moins 8 caractères. Tu t'en serviras pour te reconnecter.</p>
    <form data-form="mdp" class="es-form">
      <label>Mot de passe<input type="password" name="mdp" autocomplete="new-password" minlength="8" required></label>
      <label>Confirme le mot de passe<input type="password" name="mdp2" autocomplete="new-password" minlength="8" required></label>
      <button class="btn btn-ink" type="submit">Enregistrer</button>
    </form>`));
}
async function connexion(f) {
  const b = f.querySelector('button'); b.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.mdp.value });
  b.disabled = false;
  if (!error) { const t = document.getElementById('es-toast'); if (t) t.hidden = true; }
  if (error) message(error.status === 400 ? 'Adresse e-mail ou mot de passe incorrect.' : 'Connexion impossible pour le moment. Réessaie dans un instant.', 'erreur');
}
async function oubli(f) {
  const b = f.querySelector('button'); b.disabled = true;
  const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + location.pathname });
  b.disabled = false;
  if (error) return message('Envoi impossible pour le moment. Réessaie dans quelques minutes.', 'erreur');
  message('Si un compte existe avec cette adresse, tu vas recevoir un e-mail.');
  vueConnexion();
}
async function enregistrerMdp(f) {
  if (f.mdp.value.length < 8) return message('Le mot de passe doit faire au moins 8 caractères.', 'erreur');
  if (f.mdp.value !== f.mdp2.value) return message('Les deux mots de passe ne sont pas identiques.', 'erreur');
  const b = f.querySelector('button'); b.disabled = true;
  const { error } = await sb.auth.updateUser({ password: f.mdp.value });
  b.disabled = false;
  if (error) return message('Le mot de passe n’a pas pu être enregistré. Le lien a peut-être expiré.', 'erreur');
  st.lien = null;
  history.replaceState(null, '', location.pathname);
  message('Mot de passe enregistré.');
  route();
}

/* ---------- Vues : accueil ---------- */
function vueAccueil() {
  const s = stats();
  const dernier = st.examens[0];
  const pDernier = dernier ? pourcent(dernier.score, dernier.score_max) : null;
  const objectif = Math.ceil(s.total / 16) || 1;
  const lignes = st.examens.slice(0, 8).map((x) => {
    const p = pourcent(x.score, x.score_max);
    return `<tr><td>${jour(x.created_at)}</td><td class="num">${x.score} / ${x.score_max}</td><td class="num"><span class="es-score ${p >= EXAMEN.seuil ? 'ok' : 'ko'}">${p} %</span></td><td class="num">${duree(x.duree_s)}</td></tr>`;
  }).join('');
  afficher(cadre('accueil', `
    <p class="es-sur">${MATIERE.nom} · ${s.total} questions</p>
    <h1>Bonjour ${esc(prenom())}.</h1>
    <p class="es-lead">Ta préparation au test d'entrée de l'UPJŠ. Avance un peu chaque jour : c'est la régularité qui fait la différence.</p>
    <div class="es-stats">
      <div class="es-stat"><span class="es-stat-n">${s.vues}<small> / ${s.total}</small></span><span>questions travaillées</span><span class="es-barre" aria-hidden="true"><span style="width:${pourcent(s.vues, s.total)}%"></span></span></div>
      <div class="es-stat"><span class="es-stat-n">${s.maitrisees}</span><span>réussies au dernier essai</span></div>
      <div class="es-stat"><span class="es-stat-n">${s.aRevoir}</span><span>à revoir</span></div>
      <div class="es-stat"><span class="es-stat-n">${pDernier === null ? '–' : `${pDernier} %`}</span><span>dernier examen blanc (seuil ${EXAMEN.seuil} %)</span></div>
    </div>
    <div class="es-actions">
      <a class="btn btn-ink" href="#/entrainement">S’entraîner</a>
      <a class="btn btn-ghost" href="#/examen">Faire un examen blanc</a>
      ${s.aRevoir ? `<a class="btn btn-ghost" href="#/a-revoir">Revoir mes erreurs (${s.aRevoir})</a>` : ''}
    </div>
    <section class="es-carte">
      <h2>Ton rythme cette semaine</h2>
      <p>${pluriel(s.semaine, 'nouvelle question travaillée', 'nouvelles questions travaillées')} ces 7 derniers jours. Objectif conseillé : environ ${objectif} par semaine, pour voir toute la banque de ${MATIERE.nom.toLowerCase()} en 4 mois.</p>
      <span class="es-barre" aria-hidden="true"><span style="width:${Math.min(100, pourcent(s.semaine, objectif))}%"></span></span>
    </section>
    <section class="es-carte">
      <h2>Tes examens blancs</h2>
      ${lignes ? `<div class="es-tableau"><table><thead><tr><th>Date</th><th class="num">Score</th><th class="num">Résultat</th><th class="num">Durée</th></tr></thead><tbody>${lignes}</tbody></table></div>`
        : '<p>Pas encore d’examen blanc. Lance le premier quand tu auras travaillé une bonne partie de la banque.</p>'}
    </section>
    <p class="es-note">La biologie arrive bientôt. Les questions de chimie avec des schémas seront ajoutées plus tard.</p>`));
}

/* ---------- Vues : entraînement ---------- */
function vueEntrainement() {
  const s = stats();
  const nouvelles = s.total - s.vues;
  const blocs = [];
  for (let de = 1; de <= 600; de += 50) {
    const nb = st.questions.filter((q) => q.numero >= de && q.numero < de + 50).length;
    if (nb) blocs.push(`<option value="${de}">Questions ${de} à ${de + 49} (${nb})</option>`);
  }
  afficher(cadre('entrainement', `
    <h1>S’entraîner</h1>
    <p class="es-lead">Chaque question compte 8 propositions. Dis pour chacune si elle est vraie ou fausse, puis corrige. Une question est réussie quand les 8 sont bien jugées.</p>
    <label class="es-taille">Questions par série
      <select id="es-taille"><option value="10">10</option><option value="20" selected>20</option><option value="50">50</option></select>
    </label>
    <div class="es-choix">
      <div class="es-carte"><h2>Nouvelles questions</h2><p>${pluriel(nouvelles, 'question jamais travaillée', 'questions jamais travaillées')}, dans l'ordre de la banque.</p><button class="btn btn-ink btn-sm" type="button" data-action="serie" data-mode="nouvelles"${nouvelles ? '' : ' disabled'}>Commencer</button></div>
      <div class="es-carte"><h2>Série au hasard</h2><p>Des questions tirées dans toute la banque, déjà vues ou non.</p><button class="btn btn-ink btn-sm" type="button" data-action="serie" data-mode="hasard">Commencer</button></div>
      <div class="es-carte"><h2>Mes erreurs</h2><p>${pluriel(s.aRevoir, 'question à revoir', 'questions à revoir')}.</p><button class="btn btn-ink btn-sm" type="button" data-action="serie" data-mode="erreurs"${s.aRevoir ? '' : ' disabled'}>Commencer</button></div>
      <div class="es-carte"><h2>Par numéros</h2><p><select id="es-bloc" aria-label="Choisir les numéros">${blocs.join('')}</select></p><button class="btn btn-ink btn-sm" type="button" data-action="serie" data-mode="bloc">Commencer</button></div>
    </div>`));
}

function nouvelleSerie(mode, ids) {
  const taille = Number(document.getElementById('es-taille')?.value) || 20;
  if (!ids) {
    if (mode === 'nouvelles') ids = st.questions.filter((q) => !(st.prog.get(q.id)?.tentatives > 0)).slice(0, taille).map((q) => q.id);
    else if (mode === 'hasard') ids = melange(st.questions).slice(0, taille).map((q) => q.id);
    else if (mode === 'erreurs') ids = idsARevoir().slice(0, taille);
    else if (mode === 'bloc') {
      const de = Number(document.getElementById('es-bloc')?.value) || 1;
      ids = st.questions.filter((q) => q.numero >= de && q.numero < de + 50).map((q) => q.id);
    }
  }
  if (!ids?.length) return message('Aucune question dans cette sélection.');
  serie = { ids, i: 0, rep: {}, corrigee: false, resultats: [] };
  if (location.hash !== '#/entrainement') location.hash = '#/entrainement';
  else route();
}

function propositions(q, lettres, rep, corrige, prefixe, etiquettes) {
  const ok = bonnes(q);
  return lettres.map((l, k) => {
    const choix = rep[l];
    const etat = corrige ? (choix && (choix === 'v') === ok.has(l) ? 'ok' : 'ko') : '';
    return `<li class="es-prop ${etat}">
      <span class="es-lettre" aria-hidden="true">${etiquettes ? etiquettes[k] : l}</span>
      <span class="es-texte">${esc(q[l])}</span>
      <span class="es-vf" role="group" aria-label="Proposition ${etiquettes ? etiquettes[k] : l}" data-l="${l}">
        <button type="button" data-action="${prefixe}vf" data-l="${l}" data-v="v" aria-pressed="${choix === 'v'}"${corrige ? ' disabled' : ''}>Vrai</button>
        <button type="button" data-action="${prefixe}vf" data-l="${l}" data-v="f" aria-pressed="${choix === 'f'}"${corrige ? ' disabled' : ''}>Faux</button>
      </span>
      ${etat === 'ko' ? `<span class="es-corr">${choix ? 'Réponse' : 'Sans réponse. Réponse'} : <strong>${ok.has(l) ? 'vrai' : 'faux'}</strong></span>` : ''}
    </li>`;
  }).join('');
}

function vueSerie(haut = true) {
  if (serie.i >= serie.ids.length) return vueBilan();
  const q = st.parId.get(serie.ids[serie.i]);
  const n = serie.ids.length;
  let pied;
  if (!serie.corrigee) {
    const manque = LETTRES.filter((l) => !serie.rep[l]).length;
    pied = `<button class="btn btn-ink" type="button" data-action="corriger"${manque ? ' disabled' : ''}>Corriger</button>
      <span class="es-aide" id="es-aide">${manque ? `Encore ${pluriel(manque, 'proposition', 'propositions')} à juger` : 'Tout est jugé&#8239;: tu peux corriger.'}</span>`;
  } else {
    const r = serie.resultats[serie.resultats.length - 1];
    const msg = r.justes === 8 ? 'Parfait : 8 propositions sur 8.' : `${r.justes} propositions sur 8 bien jugées. La question passe dans « À revoir ».`;
    pied = `<p class="es-verdict ${r.justes === 8 ? 'ok' : 'ko'}">${msg}</p>
      <button class="btn btn-ink" type="button" data-action="suivante">${serie.i + 1 < n ? 'Question suivante' : 'Voir le bilan'}</button>`;
  }
  afficher(cadre('entrainement', `
    <div class="es-entete-q">
      <span>Question ${serie.i + 1} / ${n}</span>
      <button class="es-lien" type="button" data-action="quitter-serie">Arrêter la série</button>
    </div>
    <span class="es-barre" aria-hidden="true"><span style="width:${pourcent(serie.i, n)}%"></span></span>
    <article class="es-carte es-question">
      <p class="es-sur">${MATIERE.nom} · n° ${q.numero}</p>
      <h2 class="es-enonce">${esc(q.enonce)}</h2>
      <ol class="es-props">${propositions(q, LETTRES, serie.rep, serie.corrigee, '')}</ol>
      <div class="es-pied">${pied}</div>
    </article>`), haut);
}

function choisir(rep, l, v) {
  rep[l] = v;
  const grp = root.querySelector(`.es-vf[data-l="${l}"]`);
  grp?.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
}

function vfSerie(l, v) {
  if (serie.corrigee) return;
  choisir(serie.rep, l, v);
  const manque = LETTRES.filter((x) => !serie.rep[x]).length;
  const b = root.querySelector('[data-action="corriger"]');
  if (b) b.disabled = manque > 0;
  const aide = document.getElementById('es-aide');
  if (aide) aide.textContent = manque ? `Encore ${pluriel(manque, 'proposition', 'propositions')} à juger` : 'Tout est jugé : tu peux corriger.';
}

async function corriger() {
  const q = st.parId.get(serie.ids[serie.i]);
  const ok = bonnes(q);
  const justes = LETTRES.filter((l) => serie.rep[l] && (serie.rep[l] === 'v') === ok.has(l)).length;
  const parfait = justes === 8;
  serie.corrigee = true;
  serie.resultats.push({ id: q.id, justes });
  const maintenant = new Date().toISOString();
  const p = st.prog.get(q.id) || { question_id: q.id, tentatives: 0, reussites: 0, premiere_fois: maintenant };
  st.prog.set(q.id, { ...p, tentatives: p.tentatives + 1, reussites: p.reussites + (parfait ? 1 : 0), dernier_juste: parfait, a_revoir: !parfait, mis_a_jour: maintenant });
  vueSerie(false);
  const { error } = await sb.rpc('enregistrer_reponse', { q: q.id, juste: parfait });
  if (error) message('Ta réponse n’a pas pu être enregistrée. Vérifie ta connexion.', 'erreur');
}

function suivante() {
  serie.i++;
  serie.rep = {};
  serie.corrigee = false;
  vueSerie();
}

function vueBilan() {
  const n = serie.resultats.length;
  const parfaites = serie.resultats.filter((r) => r.justes === 8).length;
  const erreurs = serie.resultats.filter((r) => r.justes < 8);
  const liste = erreurs.map((r) => {
    const q = st.parId.get(r.id);
    return `<li><span class="es-num">n° ${q.numero}</span> ${esc(q.enonce)} <span class="es-petit">(${r.justes}/8)</span></li>`;
  }).join('');
  afficher(cadre('entrainement', `
    <h1>Série terminée</h1>
    <p class="es-lead">${pluriel(parfaites, 'question parfaite', 'questions parfaites')} sur ${n}.</p>
    ${erreurs.length ? `<section class="es-carte"><h2>À retravailler</h2><ul class="es-liste">${liste}</ul></section>` : '<section class="es-carte"><p>Aucune erreur sur cette série. Bravo&#8239;!</p></section>'}
    <div class="es-actions">
      ${erreurs.length ? '<button class="btn btn-ink" type="button" data-action="refaire-serie">Refaire mes erreurs de cette série</button>' : ''}
      <button class="btn btn-ghost" type="button" data-action="nouvelle-serie">Nouvelle série</button>
      <a class="btn btn-ghost" href="#/accueil">Accueil</a>
    </div>`));
}

/* ---------- Vues : examen blanc ---------- */
function vueExamenIntro() {
  const n = Math.min(EXAMEN.questions, st.questions.length);
  afficher(cadre('examen', `
    <h1>Examen blanc de ${MATIERE.nom.toLowerCase()}</h1>
    <p class="es-lead">Dans les conditions du jour J, pour la partie ${MATIERE.nom.toLowerCase()}.</p>
    <section class="es-carte">
      <ul class="es-regles">
        <li><strong>${n} questions</strong> tirées au hasard dans la banque.</li>
        <li><strong>4 propositions par question</strong>, tirées parmi les 8 : dis pour chacune si elle est vraie ou fausse, comme le jour du test.</li>
        <li><strong>${duree(EXAMEN.minutes * 60)}</strong> au chrono. Le vrai test compte 200 questions (biologie et chimie) en 2 h 30.</li>
        <li><strong>1 point par proposition bien jugée</strong>, soit ${n * EXAMEN.propositions} points, et pas de points négatifs : réponds à tout.</li>
        <li>Repère : la faculté indique en général un seuil d'admission de ${EXAMEN.seuil} %.</li>
      </ul>
      <p class="es-petit">Tu peux fermer la page : l'examen reprend où tu en étais, mais le chrono continue.</p>
      <button class="btn btn-ink" type="button" data-action="examen-commencer">Commencer l'examen</button>
    </section>`));
}

function reprendreExamen() {
  const ex = memo.lire(cleExamen());
  if (ex && ex.items?.length && ex.items.every((it) => st.parId.has(it.id))) { examen = ex; lancerMinuteur(); }
  else if (ex) memo.effacer(cleExamen());
}

function nouvelExamen() {
  const qs = melange(st.questions).slice(0, Math.min(EXAMEN.questions, st.questions.length));
  if (!qs.length) return message('Aucune question disponible.');
  const debut = Date.now();
  examen = {
    debut,
    fin: debut + EXAMEN.minutes * 60e3 * (qs.length / EXAMEN.questions),
    items: qs.map((q) => ({ id: q.id, l: melange(LETTRES).slice(0, EXAMEN.propositions).join('') })),
    rep: {},
    i: 0,
  };
  resultat = null;
  memo.ecrire(cleExamen(), examen);
  lancerMinuteur();
  vueExamen();
}

function lancerMinuteur() {
  clearInterval(minuteur);
  minuteur = setInterval(() => {
    if (!examen) { clearInterval(minuteur); minuteur = null; return; }
    const reste = (examen.fin - Date.now()) / 1000;
    const el = document.getElementById('es-chrono');
    if (el) { el.textContent = chrono(reste); el.classList.toggle('urgent', reste <= 300); }
    if (reste <= 0) terminerExamen(true);
  }, 1000);
}

const etatItem = (k) => {
  const r = examen.rep[k] || {};
  const n = examen.items[k].l.split('').filter((l) => r[l]).length;
  return n === EXAMEN.propositions ? 'complete' : n ? 'partielle' : '';
};

function vueExamen(haut = true) {
  const k = examen.i;
  const it = examen.items[k];
  const q = st.parId.get(it.id);
  const n = examen.items.length;
  const rep = examen.rep[k] || (examen.rep[k] = {});
  const incompletes = examen.items.filter((_, j) => etatItem(j) !== 'complete').length;
  const grille = examen.items.map((_, j) => `<button type="button" class="${etatItem(j)}${j === k ? ' actuelle' : ''}" data-action="ex-aller" data-i="${j}" aria-label="Question ${j + 1}">${j + 1}</button>`).join('');
  afficher(cadre('examen', `
    <div class="es-exam-barre">
      <span>Question ${k + 1} / ${n}</span>
      <span class="es-chrono" id="es-chrono" aria-label="Temps restant">${chrono((examen.fin - Date.now()) / 1000)}</span>
    </div>
    <article class="es-carte es-question">
      <p class="es-sur">${MATIERE.nom} · n° ${q.numero}</p>
      <h2 class="es-enonce">${esc(q.enonce)}</h2>
      <ol class="es-props">${propositions(q, it.l.split(''), rep, false, 'ex-', ['A', 'B', 'C', 'D'])}</ol>
      <div class="es-pied es-exam-nav">
        <button class="btn btn-ghost" type="button" data-action="ex-prec"${k ? '' : ' disabled'}>Précédente</button>
        <button class="btn btn-ink" type="button" data-action="ex-suiv"${k + 1 < n ? '' : ' disabled'}>Suivante</button>
      </div>
    </article>
    <details class="es-carte es-grille"${n <= 100 ? ' open' : ''}>
      <summary>Toutes les questions <span class="es-petit">(${n - incompletes} complètes sur ${n})</span></summary>
      <div class="es-grille-in">${grille}</div>
    </details>
    <section class="es-carte es-fin" id="es-fin">
      ${confirmation
        ? `<p><strong>Terminer l'examen&#8239;?</strong> ${incompletes ? `${pluriel(incompletes, 'question n’est pas', 'questions ne sont pas')} complètement jugée${incompletes > 1 ? 's' : ''}.` : 'Toutes les questions sont jugées.'}</p>
           <div class="es-actions"><button class="btn btn-ink" type="button" data-action="ex-confirmer">Oui, terminer</button><button class="btn btn-ghost" type="button" data-action="ex-annuler">Continuer l'examen</button></div>`
        : '<button class="btn btn-ghost" type="button" data-action="ex-terminer">Terminer l’examen</button>'}
    </section>`), haut);
}

function vfExamen(l, v) {
  const k = examen.i;
  examen.rep[k] = examen.rep[k] || {};
  choisir(examen.rep[k], l, v);
  memo.ecrire(cleExamen(), examen);
  const b = root.querySelector(`.es-grille-in [data-i="${k}"]`);
  if (b) b.className = `${etatItem(k)} actuelle`;
}

function allerQuestion(i) {
  if (!examen) return;
  examen.i = Math.max(0, Math.min(examen.items.length - 1, i));
  confirmation = false;
  memo.ecrire(cleExamen(), examen);
  vueExamen();
}

async function terminerExamen(auto = false) {
  if (!examen) return;
  clearInterval(minuteur); minuteur = null;
  const ex = examen;
  examen = null;
  memo.effacer(cleExamen());
  let score = 0;
  const rates = [];
  const details = ex.items.map((it, k) => {
    const q = st.parId.get(it.id);
    const ok = bonnes(q);
    const r = ex.rep[k] || {};
    let pts = 0;
    const choix = it.l.split('').map((l) => { if (r[l] && (r[l] === 'v') === ok.has(l)) pts++; return r[l] || '-'; }).join('');
    score += pts;
    if (pts < it.l.length) rates.push(it.id);
    return [it.id, it.l, choix, pts];
  });
  const max = ex.items.length * EXAMEN.propositions;
  const duree_s = Math.round((Math.min(Date.now(), ex.fin) - ex.debut) / 1000);
  resultat = { score, max, duree_s, details, auto };
  if (location.hash !== '#/examen') location.hash = '#/examen';
  vueResultat();
  const ins = await sb.from('examens').insert({ matiere: MATIERE.id, score, score_max: max, duree_s, details: { items: details } }).select('id, matiere, score, score_max, duree_s, created_at').single();
  if (ins.error) message('Ton résultat n’a pas pu être enregistré. Vérifie ta connexion.', 'erreur');
  else st.examens.unshift(ins.data);
  if (rates.length) {
    const r = await sb.rpc('marquer_a_revoir', { ids: rates });
    if (!r.error) {
      const maintenant = new Date().toISOString();
      for (const id of rates) {
        const p = st.prog.get(id) || { question_id: id, tentatives: 0, reussites: 0, dernier_juste: false, premiere_fois: maintenant };
        st.prog.set(id, { ...p, a_revoir: true, mis_a_jour: maintenant });
      }
    }
  }
}

function vueResultat() {
  const r = resultat;
  const p = pourcent(r.score, r.max);
  const rates = r.details.filter((d) => d[3] < d[1].length);
  const liste = rates.slice(0, 100).map(([id, lettres, choix]) => {
    const q = st.parId.get(id);
    const ok = bonnes(q);
    const lignes = lettres.split('').map((l, k) => {
      const c = choix[k];
      const juste = c !== '-' && (c === 'v') === ok.has(l);
      return `<li class="${juste ? 'ok' : 'ko'}"><span class="es-texte">${esc(q[l])}</span> <span class="es-petit">${c === '-' ? 'sans réponse' : `ta réponse : ${c === 'v' ? 'vrai' : 'faux'}`} · bonne réponse : <strong>${ok.has(l) ? 'vrai' : 'faux'}</strong></span></li>`;
    }).join('');
    return `<li><p><span class="es-num">n° ${q.numero}</span> ${esc(q.enonce)}</p><ul class="es-detail">${lignes}</ul></li>`;
  }).join('');
  afficher(cadre('examen', `
    ${r.auto ? '<p class="es-sur">Temps écoulé : l’examen a été rendu automatiquement.</p>' : ''}
    <h1>${r.score} / ${r.max} : ${p} %</h1>
    <p class="es-lead"><span class="es-score ${p >= EXAMEN.seuil ? 'ok' : 'ko'}">${p >= EXAMEN.seuil ? 'Au-dessus' : 'En dessous'} du seuil de ${EXAMEN.seuil} %</span> · durée : ${duree(r.duree_s)}</p>
    <div class="es-actions">
      ${rates.length ? '<button class="btn btn-ink" type="button" data-action="refaire-examen">Retravailler ces questions</button>' : ''}
      <button class="btn btn-ghost" type="button" data-action="examen-nouveau">Nouvel examen blanc</button>
      <a class="btn btn-ghost" href="#/accueil">Accueil</a>
    </div>
    ${rates.length ? `<section class="es-carte"><h2>${pluriel(rates.length, 'question avec au moins une erreur', 'questions avec au moins une erreur')}</h2><p class="es-petit">Elles sont aussi dans « À revoir ».</p><ol class="es-liste es-corrige">${liste}</ol></section>` : '<section class="es-carte"><p>Aucune erreur. Impressionnant&#8239;!</p></section>'}`));
}

/* ---------- Vues : à revoir, suivi, compte ---------- */
function vueARevoir() {
  const ids = idsARevoir();
  const liste = ids.map((id) => { const q = st.parId.get(id); return `<li><span class="es-num">n° ${q.numero}</span> ${esc(q.enonce)}</li>`; }).join('');
  afficher(cadre('a-revoir', `
    <h1>À revoir</h1>
    <p class="es-lead">Les questions ratées en entraînement ou en examen blanc. Une question sort de la liste quand tu la réussis en entraînement.</p>
    ${ids.length ? `<div class="es-actions"><button class="btn btn-ink" type="button" data-action="serie-erreurs">S’entraîner sur ces ${pluriel(ids.length, 'question', 'questions')}</button></div>
      <section class="es-carte"><ul class="es-liste">${liste}</ul></section>`
      : '<section class="es-carte"><p>Rien à revoir pour l’instant.</p></section>'}`));
}

async function vueSuivi() {
  afficher(cadre('suivi', '<h1>Suivi des étudiants</h1><div class="es-chargement" role="status"><span class="es-spin" aria-hidden="true"></span>Chargement…</div>'));
  const { data, error } = await sb.rpc('suivi_etudiants');
  if (location.hash !== '#/suivi') return;
  if (error) return message('Le suivi n’a pas pu être chargé.', 'erreur');
  const total = st.questions.length;
  const lignes = (data || []).map((e) => `<tr>
      <td><strong>${esc(e.nom || '')}</strong><br><span class="es-petit">${esc(e.email || '')}</span></td>
      <td class="num">${e.vues} / ${total}</td><td class="num">${e.maitrisees}</td><td class="num">${e.a_revoir}</td>
      <td class="num">${e.examens}</td>
      <td class="num">${e.dernier_examen === null ? '–' : `<span class="es-score ${e.dernier_examen >= EXAMEN.seuil ? 'ok' : 'ko'}">${Math.round(e.dernier_examen)} %</span>`}</td>
      <td class="num">${e.meilleur_examen === null ? '–' : `${Math.round(e.meilleur_examen)} %`}</td>
      <td>${e.derniere_activite ? jour(e.derniere_activite) : 'jamais'}</td></tr>`).join('');
  afficher(cadre('suivi', `
    <h1>Suivi des étudiants</h1>
    <p class="es-lead">Où en est chaque étudiant, en ${MATIERE.nom.toLowerCase()}.</p>
    ${lignes ? `<div class="es-tableau es-carte"><table><thead><tr><th>Étudiant</th><th class="num">Travaillées</th><th class="num">Réussies</th><th class="num">À revoir</th><th class="num">Examens</th><th class="num">Dernier</th><th class="num">Meilleur</th><th>Dernière activité</th></tr></thead><tbody>${lignes}</tbody></table></div>`
      : '<section class="es-carte"><p>Aucun étudiant pour l’instant.</p></section>'}
    <p class="es-note">Pour donner accès à un étudiant : Supabase, Authentication, Users, « Invite user ». Il reçoit un e-mail pour choisir son mot de passe.</p>`), false);
}

function vueCompte() {
  afficher(cadre('compte', `
    <h1>Mon compte</h1>
    <section class="es-carte">
      <p>Connecté avec <strong>${esc(st.user?.email || '')}</strong>.</p>
      <h2>Changer de mot de passe</h2>
      <form data-form="mdp" class="es-form">
        <label>Nouveau mot de passe<input type="password" name="mdp" autocomplete="new-password" minlength="8" required></label>
        <label>Confirme le mot de passe<input type="password" name="mdp2" autocomplete="new-password" minlength="8" required></label>
        <button class="btn btn-ink" type="submit">Enregistrer</button>
      </form>
    </section>`));
}

/* ---------- Événements ---------- */
const actions = {
  deconnexion: async () => {
    if (examen) memo.ecrire(cleExamen(), examen);
    await sb.auth.signOut();
  },
  oubli: () => vueOubli(),
  connexion: () => vueConnexion(),
  serie: (b) => nouvelleSerie(b.dataset.mode),
  vf: (b) => vfSerie(b.dataset.l, b.dataset.v),
  corriger: () => corriger(),
  suivante: () => suivante(),
  'quitter-serie': () => { serie = null; route(); },
  'refaire-serie': () => nouvelleSerie('liste', serie.resultats.filter((r) => r.justes < 8).map((r) => r.id)),
  'nouvelle-serie': () => { serie = null; route(); },
  'serie-erreurs': () => nouvelleSerie('liste', idsARevoir()),
  'examen-commencer': () => nouvelExamen(),
  'examen-nouveau': () => { resultat = null; vueExamenIntro(); },
  'refaire-examen': () => { const ids = resultat.details.filter((d) => d[3] < d[1].length).map((d) => d[0]); resultat = null; nouvelleSerie('liste', ids); },
  'ex-vf': (b) => vfExamen(b.dataset.l, b.dataset.v),
  'ex-prec': () => allerQuestion(examen.i - 1),
  'ex-suiv': () => allerQuestion(examen.i + 1),
  'ex-aller': (b) => allerQuestion(Number(b.dataset.i)),
  'ex-terminer': () => { confirmation = true; vueExamen(false); document.getElementById('es-fin')?.scrollIntoView({ block: 'center' }); },
  'ex-annuler': () => { confirmation = false; vueExamen(false); },
  'ex-confirmer': () => terminerExamen(false),
};
root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled || !root.contains(b)) return;
  const f = actions[b.dataset.action];
  if (f) { e.preventDefault(); f(b); }
});
root.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  ({ connexion, oubli, mdp: enregistrerMdp })[f.dataset.form]?.(f);
});

demarrer();

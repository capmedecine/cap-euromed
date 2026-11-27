/* Aperçu de l'espace étudiant : 3 questions d'exemple au format du test (écrites par Cap EuroMed,
   pas tirées de la banque de l'UPJŠ). Données et textes dans <script id="apercu-data">. */
(function () {
  const box = document.getElementById('apercu-demo');
  const src = document.getElementById('apercu-data');
  if (!box || !src) return;
  const D = JSON.parse(src.textContent);
  const T = D.textes;
  const Q = D.questions;
  const L = ['A', 'B', 'C', 'D'];
  const max = Q.reduce((s, q) => s + q.props.length, 0);
  let i = 0, rep = {}, corrige = false, total = 0;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const justes = () => Q[i].props.filter(([, vrai], k) => rep[k] && (rep[k] === 'v') === vrai).length;
  const manque = () => Q[i].props.length - Object.keys(rep).length;

  function pied() {
    if (corrige) {
      const n = justes(), m = Q[i].props.length;
      return `<p class="es-verdict ${n === m ? 'ok' : 'ko'}">${n} / ${m} ${esc(T.bien_jugees)}</p>
        <button class="btn btn-ink" type="button" data-act="suivante">${esc(i + 1 < Q.length ? T.suivante : T.resultat)}</button>`;
    }
    const r = manque();
    return `<button class="btn btn-ink" type="button" data-act="corriger"${r ? ' disabled' : ''}>${esc(T.corriger)}</button>
      <span class="es-aide">${esc(r ? T.encore.replace('{n}', r) : T.pret)}</span>`;
  }

  function question() {
    const q = Q[i];
    const props = q.props.map(([texte, vrai], k) => {
      const c = rep[k];
      const etat = corrige ? (c && (c === 'v') === vrai ? 'ok' : 'ko') : '';
      return `<li class="es-prop ${etat}">
        <span class="es-lettre" aria-hidden="true">${L[k]}</span>
        <span class="es-texte">${esc(texte)}</span>
        <span class="es-vf" role="group" aria-label="${esc(T.proposition)} ${L[k]}" data-k="${k}">
          <button type="button" data-v="v" aria-pressed="${c === 'v'}"${corrige ? ' disabled' : ''}>${esc(T.vrai)}</button>
          <button type="button" data-v="f" aria-pressed="${c === 'f'}"${corrige ? ' disabled' : ''}>${esc(T.faux)}</button>
        </span>
        ${etat === 'ko' ? `<span class="es-corr">${esc(T.reponse)} : <strong>${esc((vrai ? T.vrai : T.faux).toLowerCase())}</strong></span>` : ''}
      </li>`;
    }).join('');
    box.innerHTML = `<div class="es-entete-q"><span>${esc(T.question)} ${i + 1} / ${Q.length}</span></div>
      <article class="es-carte es-question">
        <p class="es-sur">${esc(q.matiere)}</p>
        <p class="es-enonce">${esc(q.enonce)}</p>
        <ol class="es-props">${props}</ol>
        <div class="es-pied">${pied()}</div>
      </article>`;
  }

  function fin() {
    const c = D.contact;
    box.innerHTML = `<article class="es-carte es-question apercu-fin">
        <p class="es-enonce">${esc(T.fin.replace('{n}', total).replace('{max}', max))}</p>
        <p>${esc(T.fin_texte)}</p>
        <div class="es-actions">
          <a class="btn btn-ink" href="${esc(c.url)}" target="_blank" rel="noopener" data-cta="apercu"><svg class="ic wa-ic" aria-hidden="true"><use href="#i-whatsapp"/></svg>${esc(c.label)}</a>
          <button class="btn btn-ghost" type="button" data-act="recommencer">${esc(T.recommencer)}</button>
        </div>
      </article>`;
  }

  function enVue() {
    if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !box.contains(b)) return;
    if (b.dataset.v) {
      const grp = b.closest('.es-vf');
      rep[grp.dataset.k] = b.dataset.v;
      grp.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      box.querySelector('.es-pied').innerHTML = pied();
      return;
    }
    const act = b.dataset.act;
    if (act === 'corriger') { corrige = true; total += justes(); question(); }
    else if (act === 'suivante') { i++; rep = {}; corrige = false; if (i < Q.length) question(); else fin(); enVue(); }
    else if (act === 'recommencer') { i = 0; rep = {}; corrige = false; total = 0; question(); enVue(); }
  });

  question();
})();

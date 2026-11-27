// Visuels de marque générés à partir de visuel.html (non publié : Jekyll ignore les dossiers en « _ »).
// Lancer depuis ce dossier : NODE_PATH=$(npm root -g) node rendu.js
// - images d'aperçu du site (Open Graph), écrites dans assets/ ;
// - photo de profil et couverture Facebook, écrites ici.
// Après un changement des images d'aperçu, leur donner un nouveau nom de fichier
// (Facebook garde l'ancienne image en cache tant que l'adresse ne change pas).
const { chromium } = require('playwright');
const path = require('path');
const ici = __dirname;
const assets = path.join(ici, '..', '..', 'assets');
const variantes = [
  { q: 'fmt=og&lang=fr', w: 1200, h: 630, out: path.join(assets, 'og-cap-euromed.jpg') },
  { q: 'fmt=og&lang=en', w: 1200, h: 630, out: path.join(assets, 'og-cap-euromed-en.jpg') },
  { q: 'fmt=cover&lang=fr', w: 1640, h: 924, out: path.join(ici, 'couverture-facebook.png') },
  { q: 'fmt=avatar', w: 1080, h: 1080, out: path.join(ici, 'photo-profil.png') },
];
(async () => {
  const b = await chromium.launch();
  for (const v of variantes) {
    const p = await b.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.join(ici, 'visuel.html') + '?' + v.q);
    const ok = await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      return [...document.images].every((i) => i.naturalWidth > 0);
    });
    if (!ok) throw new Error('Image non chargée pour ' + v.q);
    const opts = { path: v.out, clip: { x: 0, y: 0, width: v.w, height: v.h } };
    if (v.out.endsWith('.jpg')) { opts.type = 'jpeg'; opts.quality = 88; }
    await p.screenshot(opts);
    console.log('OK ' + path.relative(path.join(ici, '..', '..'), v.out));
    await p.close();
  }
  await b.close();
})();

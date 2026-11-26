# Espace étudiant : base Supabase

L'espace étudiant (`/espace-etudiant/app/`, page cachée tant que le bouton du site mène à « En construction »)
est une page statique du site : `_layouts/espace.html`, `assets/js/espace.js`, `assets/css/espace.css`,
et la bibliothèque `assets/js/vendor/supabase-2.119.0.js`. Les comptes et les données sont chez Supabase.

## Installation (une fois)
1. Créer un projet Supabase (région Europe, par exemple Paris).
2. SQL Editor : coller `1-structure.sql`, Run. Puis le script des questions `2-questions-chimie.sql`
   (fourni à part : la banque de l'UPJŠ ne doit pas être dans ce dépôt public), Run.
3. Authentication > Sign In / Providers : désactiver « Allow new users to sign up » (accès sur invitation seulement).
4. Authentication > URL Configuration : Site URL = `https://cap-euromed.fr/espace-etudiant/app/`,
   et la même adresse dans Redirect URLs.
5. Project Settings > API : recopier l'URL du projet et la clé « anon public » dans `_config.yml`
   (`supabase_url`, `supabase_anon_key`). La clé anon est publique par conception : les règles RLS protègent les données.
6. S'inviter (Authentication > Users > Invite user), puis passer son compte en admin avec la dernière ligne de `1-structure.sql`.

## Au quotidien
- Ajouter un étudiant : Authentication > Users > Invite user. Il reçoit un e-mail pour choisir son mot de passe.
- Retirer un accès : Authentication > Users > supprimer le compte (sa progression est supprimée avec).
- Mettre à jour ou ajouter des questions : relancer un script `2-questions-<matière>.sql` (il met à jour sans doublon).
- Plan gratuit : le projet se met en pause après 7 jours sans activité ; le relancer depuis le tableau de bord Supabase.

## Sécurité (RLS)
- Sans compte : aucune donnée lisible.
- Étudiant : lit les questions complètes, sa propre progression et ses propres examens blancs.
- Admin (`profils.role = 'admin'`) : lit aussi la progression et les examens de tous (onglet « Suivi des étudiants »).

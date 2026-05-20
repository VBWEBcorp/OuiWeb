# OUIWEB — LinkedIn growth, scheduled.

SaaS premium pour rédiger, générer (IA DeepSeek), programmer et publier des posts LinkedIn
sur plusieurs comptes (Victor Béasse, Yannick Béasse). Inspiré de Typefully / Buffer / Hypefury.

## ✨ Fonctionnalités

- **Multi-comptes** LinkedIn (Victor / Yannick) — switch instantané, persona & calendrier indépendants.
- **Composer premium** : éditeur live, autosave, drag & drop médias, aperçu LinkedIn natif.
- **Génération IA DeepSeek** : variantes, hooks, hashtags, reformulation, raccourcissement.
- **Persona / contexte business** par compte, injecté automatiquement dans les prompts.
- **Calendrier** mois / semaine, drag & drop pour reprogrammer.
- **Publication LinkedIn réelle** via OAuth 2.0 + `ugcPosts`.
- **Scheduler** : in-process en dev, Netlify Scheduled Function en prod (cron `* * * * *`).
- **MongoDB** (collections users / linkedinAccounts / posts / scheduledPosts / aiHistory / analytics / mediaAssets). Fallback fichier JSON en dev.
- **Sécurité** : tokens LinkedIn chiffrés AES-256-GCM, secrets via `.env`.
- **Infra** : Vite + Tailwind frontend, Netlify Functions backend, Cloudflare-friendly headers.
- **Dark mode** premium inspiré Linear / Vercel / Notion / Typefully.

## 🧱 Stack

- Frontend : **ViteJS**, React 18, TypeScript, TailwindCSS, Zustand, React Query, Framer Motion, lucide-react
- Backend : Express (dev) + Netlify Functions (prod), Mongoose
- IA : **DeepSeek API** (`deepseek-chat`)
- Social : **LinkedIn API v2** (OAuth + ugcPosts)
- DB : **MongoDB Atlas**
- Infra : **Cloudflare** (CDN, headers) + **Netlify** (hosting + functions + scheduler)

## 🚀 Lancement local

```bash
npm install
cp .env.example .env       # remplir DEEPSEEK_API_KEY + LINKEDIN_* si voulu
npm run dev
```

- Frontend : <http://localhost:5173>
- API      : <http://localhost:8787/api>

> Pas besoin de MongoDB local : si `MONGODB_URI` est vide, l'app utilise un store JSON
> dans `data/db.json`. Idéal pour tester rapidement.

## 🔑 Variables d'environnement

Voir [.env.example](.env.example). Indispensables en production :

| Variable                | Rôle                                   |
| ----------------------- | -------------------------------------- |
| `MONGODB_URI`           | Connexion MongoDB Atlas                |
| `DEEPSEEK_API_KEY`      | Génération IA                          |
| `LINKEDIN_CLIENT_ID`    | OAuth LinkedIn                         |
| `LINKEDIN_CLIENT_SECRET`| OAuth LinkedIn                         |
| `LINKEDIN_REDIRECT_URI` | Doit matcher l'app LinkedIn           |
| `JWT_SECRET`            | Sessions                               |
| `TOKEN_ENC_KEY`         | 32 bytes hex pour AES-256-GCM          |

## 📁 Structure

```
.
├── src/                  # Frontend Vite (React + Tailwind)
│   ├── components/       # Sidebar, AccountSwitcher, PostCard, StatusBadge…
│   ├── pages/            # Dashboard, Compose, CalendarPage, Persona, Analytics, Settings
│   └── lib/              # api.ts, store.ts, utils.ts, constants.ts
├── server/               # Backend partagé
│   ├── routes.ts         # Express router (utilisé par dev + Netlify Functions)
│   ├── db/store.ts       # Adapter MongoDB / fichier JSON
│   ├── services/
│   │   ├── deepseek.ts   # Prompts + appel DeepSeek + fallback mock
│   │   └── linkedin.ts   # OAuth + ugcPosts + token enc/dec
│   ├── lib/crypto.ts     # AES-256-GCM helpers
│   └── dev.ts            # Express server local (avec scheduler in-process)
├── netlify/functions/
│   ├── api.ts            # Wrapper Netlify Functions → Express
│   └── scheduled-publish.ts  # cron "* * * * *"
├── netlify.toml
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 🧠 Comment l'IA utilise le persona

À chaque appel `/ai/generate` ou `/ai/improve`, le serveur charge le `Persona` du compte
courant et l'injecte dans le system prompt DeepSeek (audience, contexte business, ton,
style, sujets, CTA favoris). Les prompts sont stockés dans la collection `aiHistory`.

## 🔄 Publication LinkedIn

1. **Connecter** chaque compte depuis *Réglages* → bouton "Connecter LinkedIn".
2. OAuth 2.0 (scopes `openid profile email w_member_social`).
3. Tokens chiffrés AES-256-GCM (`TOKEN_ENC_KEY`).
4. Publication via `POST https://api.linkedin.com/v2/ugcPosts` avec auteur `urn:li:person:{sub}`.
5. Scheduled posts : function `scheduled-publish` (Netlify cron).

## 🛡️ Sécurité

- Tokens LinkedIn jamais retournés au client (filtrés dans `/accounts`).
- AES-256-GCM avec clé 32 bytes (hex) configurable.
- Headers durcis via `netlify.toml`.
- Compatible Cloudflare (proxy, Rules, Cache TTL longs sur `/assets/*`).

## 🚢 Déploiement Netlify

```bash
netlify deploy --prod
```

- `npm run build` produit `dist/`.
- Les fonctions dans `netlify/functions/` sont packagées automatiquement.
- Active la **Scheduled Function** `scheduled-publish` dans le dashboard Netlify (cron `* * * * *`).
- Pointe ton domaine via Cloudflare (proxy ON) et garde les redirections `/api/*`.

# Checklist de archivos completos

Antes de subir al repo, confirma que tienes exactamente esta estructura:

```text
MercadoOS_Admin_COMPLETO/
├── .github/
│   └── workflows/
│       └── pages.yml
├── backend/
│   ├── Code.gs
│   ├── appsscript.json
│   └── README_BACKEND.md
├── frontend/
│   ├── assets/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── .nojekyll
│   ├── app.js
│   ├── config.js
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── styles.css
│   └── sw.js
├── workflow-visible/
│   └── pages.yml
├── README.md
├── SETUP_BACKEND_APPS_SCRIPT.md
├── SETUP_GITHUB_PAGES.md
└── CHECKLIST_ARCHIVOS.md
```

## Importante

- GitHub necesita la carpeta oculta `.github/workflows/pages.yml`.
- En Mac, Finder puede ocultar `.github`. Por eso también dejé una copia visible en `workflow-visible/pages.yml`.
- Si no ves `.github`, no significa que no esté; pero sí debes subirla al repo.
- El frontend que se publica en GitHub Pages es `frontend/`.
- El backend se pega manualmente en Google Apps Script desde `backend/Code.gs`.

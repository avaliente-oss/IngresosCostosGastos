# Setup GitHub Pages

## 1. Sube los archivos al repo

Sube el contenido completo de `MercadoOS_Admin_COMPLETO`, incluyendo:

- `.github/`
- `frontend/`
- `backend/`
- `README.md`
- archivos de setup

No subas solamente el ZIP. GitHub no descomprime ZIPs automáticamente cuando los subes al repo.

## 2. Activa GitHub Pages

En GitHub:

1. Settings
2. Pages
3. Build and deployment
4. Source: `GitHub Actions`

## 3. Corre el workflow

En GitHub:

1. Actions
2. Deploy frontend to GitHub Pages
3. Run workflow

El workflow publica únicamente la carpeta `frontend/`.

## 4. Si falla con “Deployment cancelled”

Haz esto:

1. Ve a Actions.
2. Cancela corridas viejas en cola.
3. Ve a Settings > Pages.
4. Confirma que Source sea `GitHub Actions`.
5. Corre de nuevo el workflow.

## 5. Si no aparece `.github`

En Mac puede estar oculta. Puedes verla con:

```bash
Cmd + Shift + .
```

También dejé una copia visible en:

```text
workflow-visible/pages.yml
```

Pero para que GitHub Actions funcione, el archivo debe estar realmente en:

```text
.github/workflows/pages.yml
```

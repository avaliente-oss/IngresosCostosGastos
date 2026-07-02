# Setup Backend Apps Script + Google Sheets

## 1. Crear Google Sheet

Crea un Google Sheet vacío. Copia el ID del documento.

El ID está en el URL:

```text
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

## 2. Pegar backend

Abre el Sheet > Extensiones > Apps Script.

Pega el contenido de:

```text
backend/Code.gs
```

## 3. Configurar variables

Dentro de `Code.gs`, modifica:

```js
SPREADSHEET_ID: 'TU_ID_DE_GOOGLE_SHEET',
API_PIN: '4321'
```

## 4. Inicializar base

Ejecuta:

```js
setupDatabase()
```

Luego ejecuta:

```js
seedDemoData()
```

## 5. Publicar Web App

En Apps Script:

1. Deploy
2. New deployment
3. Type: Web app
4. Execute as: Me
5. Who has access: Anyone
6. Deploy

Copia el URL que termina en `/exec`.

## 6. Conectar frontend

Abre:

```text
frontend/config.js
```

Pega:

```js
API_URL: 'https://script.google.com/macros/s/TU_DEPLOYMENT/exec',
DEMO_PIN: '4321',
AUTO_CONNECT: true
```

Después sube de nuevo el frontend al repo o corre el workflow de GitHub Pages.

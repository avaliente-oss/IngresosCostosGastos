# MercadoOS Admin — PWA administrativa para supermercado

Demo vendible de aplicación administrativa formal para supermercado o negocio retail.

No está pensada como dashboard. Está pensada como app operativa tipo SaaS/ERP ligero.

## Módulos incluidos

- Inicio operativo
- Caja e ingresos
- Inventario
- Compras y cuentas por pagar
- Gastos
- Movimientos de inventario
- Proveedores
- Conexión técnica

## Arquitectura

```text
Frontend PWA en GitHub Pages
        ↓
Apps Script Web App como API
        ↓
Google Sheets como base de datos
```

## Estructura del proyecto

```text
.github/workflows/pages.yml      Workflow para desplegar GitHub Pages
backend/Code.gs                  Backend Apps Script
backend/appsscript.json          Manifiesto Apps Script
frontend/index.html              App principal
frontend/styles.css              Estilos profesionales
frontend/app.js                  Lógica frontend
frontend/config.js               Conexión automática backend + PIN
frontend/manifest.webmanifest    Instalación PWA
frontend/sw.js                   Service worker
frontend/assets/                 Íconos PWA
```

## Configuración rápida

1. Crea un Google Sheet vacío.
2. Pega `backend/Code.gs` en Apps Script.
3. Cambia `SPREADSHEET_ID` y `API_PIN`.
4. Ejecuta `setupDatabase()`.
5. Ejecuta `seedDemoData()`.
6. Publica Apps Script como Web App.
7. Copia el URL `/exec`.
8. Pégalo en `frontend/config.js`.
9. Sube el proyecto completo a GitHub.
10. Activa GitHub Pages usando GitHub Actions.

## Conexión automática

En `frontend/config.js`:

```js
window.APP_CONFIG = {
  APP_NAME: 'MercadoOS Admin',
  STORE_NAME: 'Supermercado La Central',
  API_URL: 'https://script.google.com/macros/s/TU_DEPLOYMENT/exec',
  DEMO_PIN: '4321',
  AUTO_CONNECT: true,
  ALLOW_MANUAL_CONNECTION: true
};
```

Con esto, el cliente no pega backend ni PIN. Abre la app y ya entra conectado.

## Publicación en GitHub Pages

El workflow está en:

```text
.github/workflows/pages.yml
```

Publica únicamente:

```text
frontend/
```

## Archivos de ayuda

- `SETUP_BACKEND_APPS_SCRIPT.md`
- `SETUP_GITHUB_PAGES.md`
- `CHECKLIST_ARCHIVOS.md`

## Nota de seguridad

El PIN en frontend sirve para demo y control básico. No es seguridad real para datos productivos. En producción se recomienda login real, roles, permisos y auditoría.

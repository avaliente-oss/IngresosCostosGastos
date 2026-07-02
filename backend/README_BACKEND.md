# Backend Apps Script

Este backend funciona como API para la PWA.

## Archivos

- `Code.gs`: lógica principal del backend.
- `appsscript.json`: manifiesto de Apps Script.

## Pasos rápidos

1. Crea un Google Sheet vacío.
2. Copia el ID del Sheet.
3. Entra a Extensiones > Apps Script.
4. Pega el contenido de `Code.gs`.
5. Cambia en `CONFIG`:
   - `SPREADSHEET_ID`
   - `API_PIN`
6. Ejecuta `setupDatabase()`.
7. Ejecuta `seedDemoData()` si quieres datos dummy.
8. Publica como Web App.
9. Copia el URL terminado en `/exec`.
10. Pega ese URL en `frontend/config.js`.

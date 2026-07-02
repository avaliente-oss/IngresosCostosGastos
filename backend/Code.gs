/**
 * SuperAdmin Retail Demo API v1.0
 * Backend: Google Apps Script + Google Sheets
 * Frontend: GitHub Pages PWA
 *
 * Setup:
 * 1) Crea un Google Sheet vacío.
 * 2) Copia el ID del URL y pégalo en CONFIG.SPREADSHEET_ID.
 * 3) Define CONFIG.API_PIN y usa el mismo PIN en el frontend.
 * 4) Ejecuta setupDatabase() una vez desde Apps Script.
 * 5) Deploy > New deployment > Web app > Execute as Me > Anyone.
 */

const CONFIG = {
  SPREADSHEET_ID: 'PEGA_AQUI_TU_SHEET_ID',
  API_PIN: '1234',
  TZ: 'America/Mexico_City',
  STORE_NAME: 'Supermercado La Central',
  VERSION: '1.0.0'
};

const SHEETS = {
  CONFIG: 'Config',
  PRODUCTS: 'Productos',
  SALES: 'Ingresos',
  EXPENSES: 'Gastos',
  MOVEMENTS: 'MovimientosInventario',
  SUPPLIERS: 'Proveedores',
  CUSTOMERS: 'Clientes',
  PURCHASES: 'Compras',
  USERS: 'Usuarios',
  BUDGETS: 'Presupuestos'
};

const SCHEMA = {
  [SHEETS.CONFIG]: ['key', 'value', 'updatedAt'],
  [SHEETS.PRODUCTS]: ['id', 'sku', 'nombre', 'categoria', 'unidad', 'proveedorId', 'costoUnitario', 'precioVenta', 'stockActual', 'stockMinimo', 'iva', 'estatus', 'updatedAt'],
  [SHEETS.SALES]: ['id', 'fecha', 'folio', 'canal', 'clienteId', 'metodoPago', 'subtotal', 'descuento', 'iva', 'total', 'costoVenta', 'utilidad', 'estatus', 'notas', 'createdAt'],
  [SHEETS.EXPENSES]: ['id', 'fecha', 'categoria', 'proveedorId', 'metodoPago', 'subtotal', 'iva', 'total', 'estatus', 'notas', 'createdAt'],
  [SHEETS.MOVEMENTS]: ['id', 'fecha', 'tipo', 'sku', 'producto', 'cantidad', 'costoUnitario', 'impactoCosto', 'motivo', 'referencia', 'usuario', 'createdAt'],
  [SHEETS.SUPPLIERS]: ['id', 'nombre', 'categoria', 'contacto', 'telefono', 'email', 'diasCredito', 'estatus'],
  [SHEETS.CUSTOMERS]: ['id', 'nombre', 'segmento', 'telefono', 'email', 'estatus'],
  [SHEETS.PURCHASES]: ['id', 'fecha', 'folio', 'proveedorId', 'subtotal', 'iva', 'total', 'estatusPago', 'fechaVencimiento', 'notas', 'createdAt'],
  [SHEETS.USERS]: ['id', 'nombre', 'rol', 'email', 'estatus'],
  [SHEETS.BUDGETS]: ['id', 'mes', 'categoria', 'presupuesto', 'tipo', 'updatedAt']
};

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  const started = Date.now();
  try {
    const req = parseRequest_(e, method);
    if (!isValidPin_(req.pin)) {
      return json_({
        success: false,
        message: 'PIN inválido o faltante.',
        serverTime: now_(),
        version: CONFIG.VERSION
      });
    }

    const action = String(req.action || 'summary').trim();
    let result;

    switch (action) {
      case 'ping':
        result = { success: true, message: 'API activa', storeName: CONFIG.STORE_NAME, serverTime: now_(), version: CONFIG.VERSION };
        break;
      case 'setup':
      case 'initDemo':
        result = setupDatabase();
        break;
      case 'summary':
        result = getDashboardSummary_(req.payload || {});
        break;
      case 'list':
        result = listRecords_(req.payload || {});
        break;
      case 'create':
        result = createRecord_(req.payload || {});
        break;
      case 'bulkSeed':
        result = seedDummyData_();
        break;
      default:
        result = { success: false, message: 'Acción no soportada: ' + action };
    }

    result.meta = Object.assign(result.meta || {}, {
      action,
      elapsedMs: Date.now() - started,
      serverTime: now_(),
      version: CONFIG.VERSION
    });
    return json_(result);
  } catch (err) {
    return json_({
      success: false,
      message: err.message || String(err),
      stack: err.stack || null,
      serverTime: now_(),
      version: CONFIG.VERSION
    });
  }
}

function parseRequest_(e, method) {
  const params = (e && e.parameter) ? e.parameter : {};
  let body = {};
  if (method === 'POST' && e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      body = {};
    }
  }
  return {
    pin: body.pin || params.pin || '',
    action: body.action || params.action || 'summary',
    payload: body.payload || parsePayloadFromParams_(params)
  };
}

function parsePayloadFromParams_(params) {
  if (params.payload) {
    try { return JSON.parse(params.payload); } catch (err) { return {}; }
  }
  const payload = {};
  Object.keys(params || {}).forEach(k => {
    if (k !== 'pin' && k !== 'action') payload[k] = params[k];
  });
  return payload;
}

function isValidPin_(pin) {
  return String(pin || '').trim() === String(CONFIG.API_PIN || '').trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function ss_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'PEGA_AQUI_TU_SHEET_ID') {
    throw new Error('Falta configurar CONFIG.SPREADSHEET_ID en Code.gs');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function setupDatabase() {
  ensureSheets_();
  seedDummyData_();
  writeConfig_();
  return { success: true, message: 'Base demo creada/actualizada correctamente.', sheets: Object.values(SHEETS) };
}

function ensureSheets_() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(sheetName => {
    let sh = ss.getSheetByName(sheetName);
    if (!sh) sh = ss.insertSheet(sheetName);
    const headers = SCHEMA[sheetName];
    const currentHeaders = sh.getLastColumn() ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0] : [];
    const needsHeaders = currentHeaders.slice(0, headers.length).join('|') !== headers.join('|');
    if (needsHeaders) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff');
      sh.autoResizeColumns(1, headers.length);
    }
  });
}

function writeConfig_() {
  const sh = ss_().getSheetByName(SHEETS.CONFIG);
  const rows = [
    ['storeName', CONFIG.STORE_NAME, now_()],
    ['timezone', CONFIG.TZ, now_()],
    ['version', CONFIG.VERSION, now_()],
    ['currency', 'MXN', now_()],
    ['businessType', 'Supermercado / Retail', now_()]
  ];
  replaceData_(sh, SCHEMA[SHEETS.CONFIG], rows);
}

function seedDummyData_() {
  ensureSheets_();
  const ss = ss_();

  replaceData_(ss.getSheetByName(SHEETS.SUPPLIERS), SCHEMA[SHEETS.SUPPLIERS], [
    ['SUP-001','Abarrotes del Centro','Abarrotes','María López','222-100-1001','ventas@abarrotescentro.mx',15,'Activo'],
    ['SUP-002','Lácteos Puebla','Lácteos','Jorge Morales','222-100-1002','pedidos@lacteospuebla.mx',7,'Activo'],
    ['SUP-003','Carnes Selectas MX','Carnes','Daniela Vega','222-100-1003','contacto@carnesselectas.mx',10,'Activo'],
    ['SUP-004','Frutas San Miguel','Frutas y verduras','Roberto Ruiz','222-100-1004','compras@frutassanmi.mx',5,'Activo'],
    ['SUP-005','Limpieza Pro Hogar','Limpieza','Andrea Santos','222-100-1005','ventas@prohogar.mx',20,'Activo']
  ]);

  replaceData_(ss.getSheetByName(SHEETS.CUSTOMERS), SCHEMA[SHEETS.CUSTOMERS], [
    ['CLI-001','Cliente mostrador','General','','','Activo'],
    ['CLI-002','Restaurante El Comal','Mayoreo','222-200-2002','compras@elcomal.mx','Activo'],
    ['CLI-003','Cafetería Alameda','Mayoreo','222-200-2003','admin@cafeteriaalameda.mx','Activo'],
    ['CLI-004','Vecino frecuente','Lealtad','222-200-2004','','Activo']
  ]);

  replaceData_(ss.getSheetByName(SHEETS.USERS), SCHEMA[SHEETS.USERS], [
    ['USR-001','Gerente demo','Administrador','gerente@demo.mx','Activo'],
    ['USR-002','Caja 1','Cajero','caja1@demo.mx','Activo'],
    ['USR-003','Almacén','Inventario','almacen@demo.mx','Activo']
  ]);

  const products = [
    ['PROD-001','SKU-ARZ-001','Arroz 1 kg','Abarrotes','pz','SUP-001',18.5,29.0,128,35,0.16,'Activo',now_()],
    ['PROD-002','SKU-FRJ-001','Frijol negro 900 g','Abarrotes','pz','SUP-001',22.0,35.0,94,30,0.16,'Activo',now_()],
    ['PROD-003','SKU-ACE-001','Aceite vegetal 1 L','Abarrotes','pz','SUP-001',31.0,49.0,62,20,0.16,'Activo',now_()],
    ['PROD-004','SKU-LEC-001','Leche entera 1 L','Lácteos','pz','SUP-002',18.0,27.0,36,45,0.00,'Activo',now_()],
    ['PROD-005','SKU-QUE-001','Queso panela 400 g','Lácteos','pz','SUP-002',48.0,72.0,24,18,0.00,'Activo',now_()],
    ['PROD-006','SKU-HUE-001','Huevo blanco 18 pz','Proteína','cartón','SUP-003',48.0,69.0,41,25,0.00,'Activo',now_()],
    ['PROD-007','SKU-POL-001','Pechuga pollo kg','Carnes','kg','SUP-003',78.0,118.0,18,15,0.00,'Activo',now_()],
    ['PROD-008','SKU-RES-001','Carne molida kg','Carnes','kg','SUP-003',105.0,159.0,12,12,0.00,'Activo',now_()],
    ['PROD-009','SKU-JIT-001','Jitomate saladet kg','Frutas y verduras','kg','SUP-004',18.0,32.0,55,30,0.00,'Activo',now_()],
    ['PROD-010','SKU-PLA-001','Plátano kg','Frutas y verduras','kg','SUP-004',14.0,26.0,47,35,0.00,'Activo',now_()],
    ['PROD-011','SKU-DET-001','Detergente 1 kg','Limpieza','pz','SUP-005',34.0,59.0,29,20,0.16,'Activo',now_()],
    ['PROD-012','SKU-PAP-001','Papel higiénico 4 rollos','Limpieza','pz','SUP-005',29.0,48.0,77,25,0.16,'Activo',now_()]
  ];
  replaceData_(ss.getSheetByName(SHEETS.PRODUCTS), SCHEMA[SHEETS.PRODUCTS], products);

  const today = new Date();
  const sales = [];
  const channels = ['Mostrador','WhatsApp','Domicilio','Mayoreo'];
  const payments = ['Efectivo','Tarjeta','Transferencia','Vales'];
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const subtotal = round_(450 + Math.random() * 5200);
    const discount = Math.random() > 0.82 ? round_(subtotal * 0.05) : 0;
    const iva = round_((subtotal - discount) * 0.09);
    const total = round_(subtotal - discount + iva);
    const costo = round_(total * (0.62 + Math.random() * 0.09));
    const utilidad = round_(total - costo);
    sales.push([
      'VEN-' + pad_(i + 1, 4),
      Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'),
      'TCK-' + pad_(1000 + i, 5),
      channels[i % channels.length],
      ['CLI-001','CLI-002','CLI-003','CLI-004'][i % 4],
      payments[i % payments.length],
      subtotal,
      discount,
      iva,
      total,
      costo,
      utilidad,
      'Cobrado',
      i % 12 === 0 ? 'Pedido recurrente' : '',
      now_()
    ]);
  }
  replaceData_(ss.getSheetByName(SHEETS.SALES), SCHEMA[SHEETS.SALES], sales);

  const expenseCats = ['Renta','Nómina','Luz','Agua','Marketing','Mantenimiento','Merma','Transporte','Empaque'];
  const expenses = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (i * 2));
    const subtotal = round_(280 + Math.random() * 3500);
    const iva = round_(subtotal * 0.16);
    expenses.push([
      'GAS-' + pad_(i + 1, 4),
      Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'),
      expenseCats[i % expenseCats.length],
      ['SUP-001','SUP-002','SUP-003','SUP-004','SUP-005'][i % 5],
      payments[i % payments.length],
      subtotal,
      iva,
      round_(subtotal + iva),
      i % 5 === 0 ? 'Pendiente' : 'Pagado',
      i % 9 === 0 ? 'Gasto operativo extraordinario' : '',
      now_()
    ]);
  }
  replaceData_(ss.getSheetByName(SHEETS.EXPENSES), SCHEMA[SHEETS.EXPENSES], expenses);

  const movements = [];
  const movementTypes = ['Entrada compra','Salida venta','Ajuste inventario','Merma','Traspaso'];
  for (let i = 0; i < 80; i++) {
    const prod = products[i % products.length];
    const d = new Date(today);
    d.setDate(today.getDate() - Math.floor(i / 2));
    const type = movementTypes[i % movementTypes.length];
    const qty = type === 'Entrada compra' ? Math.ceil(15 + Math.random() * 60) : -Math.ceil(1 + Math.random() * 12);
    const unitCost = Number(prod[6]);
    movements.push([
      'MOV-' + pad_(i + 1, 4),
      Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'),
      type,
      prod[1],
      prod[2],
      qty,
      unitCost,
      round_(qty * unitCost),
      type === 'Merma' ? 'Producto dañado/caducado' : type,
      type === 'Salida venta' ? 'TCK-' + pad_(1000 + i, 5) : 'REF-' + pad_(i + 1, 4),
      i % 3 === 0 ? 'USR-003' : 'USR-002',
      now_()
    ]);
  }
  replaceData_(ss.getSheetByName(SHEETS.MOVEMENTS), SCHEMA[SHEETS.MOVEMENTS], movements);

  const purchases = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (i * 3));
    const subtotal = round_(1800 + Math.random() * 12000);
    const iva = round_(subtotal * 0.08);
    const due = new Date(d);
    due.setDate(d.getDate() + [5,7,10,15,20][i % 5]);
    purchases.push([
      'COM-' + pad_(i + 1, 4),
      Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'),
      'FAC-' + pad_(3000 + i, 5),
      ['SUP-001','SUP-002','SUP-003','SUP-004','SUP-005'][i % 5],
      subtotal,
      iva,
      round_(subtotal + iva),
      i % 4 === 0 ? 'Pendiente' : 'Pagado',
      Utilities.formatDate(due, CONFIG.TZ, 'yyyy-MM-dd'),
      '',
      now_()
    ]);
  }
  replaceData_(ss.getSheetByName(SHEETS.PURCHASES), SCHEMA[SHEETS.PURCHASES], purchases);

  const ym = Utilities.formatDate(today, CONFIG.TZ, 'yyyy-MM');
  replaceData_(ss.getSheetByName(SHEETS.BUDGETS), SCHEMA[SHEETS.BUDGETS], [
    ['PRE-001', ym, 'Ventas', 245000, 'Ingreso', now_()],
    ['PRE-002', ym, 'Renta', 25000, 'Gasto', now_()],
    ['PRE-003', ym, 'Nómina', 52000, 'Gasto', now_()],
    ['PRE-004', ym, 'Marketing', 12000, 'Gasto', now_()],
    ['PRE-005', ym, 'Merma', 8500, 'Gasto', now_()]
  ]);

  return { success: true, message: 'Datos dummy cargados.', rows: { products: products.length, sales: sales.length, expenses: expenses.length, movements: movements.length } };
}

function replaceData_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows && rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, headers.length);
}

function listRecords_(payload) {
  const entity = String(payload.entity || 'sales');
  const map = entityToSheet_();
  const sheetName = map[entity];
  if (!sheetName) return { success: false, message: 'Entidad no soportada: ' + entity };

  const limit = Number(payload.limit || 100);
  const rows = readSheetObjects_(sheetName)
    .sort((a, b) => String(b.fecha || b.createdAt || '').localeCompare(String(a.fecha || a.createdAt || '')))
    .slice(0, limit);

  return { success: true, entity, count: rows.length, data: rows };
}

function createRecord_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const entity = String(payload.entity || '').trim();
    const record = payload.record || {};
    const map = entityToSheet_();
    const sheetName = map[entity];
    if (!sheetName) return { success: false, message: 'Entidad no soportada para creación: ' + entity };
    const clean = normalizeCreateRecord_(entity, record);
    appendObject_(sheetName, clean);
    if (entity === 'movements') updateStockFromMovement_(clean);
    CacheService.getScriptCache().remove('summary');
    return { success: true, message: 'Registro creado.', entity, data: clean };
  } finally {
    lock.releaseLock();
  }
}

function normalizeCreateRecord_(entity, r) {
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  if (entity === 'sales') {
    const subtotal = num_(r.subtotal);
    const discount = num_(r.descuento || r.discount);
    const iva = num_(r.iva || (subtotal - discount) * 0.16);
    const total = num_(r.total || subtotal - discount + iva);
    const costo = num_(r.costoVenta || total * 0.65);
    return {
      id: newId_('VEN'), fecha: r.fecha || today, folio: r.folio || newId_('TCK'), canal: r.canal || 'Mostrador', clienteId: r.clienteId || 'CLI-001', metodoPago: r.metodoPago || 'Efectivo', subtotal,
      descuento: discount, iva, total, costoVenta: costo, utilidad: round_(total - costo), estatus: r.estatus || 'Cobrado', notas: r.notas || '', createdAt: now_()
    };
  }
  if (entity === 'expenses') {
    const subtotal = num_(r.subtotal);
    const iva = num_(r.iva || subtotal * 0.16);
    return {
      id: newId_('GAS'), fecha: r.fecha || today, categoria: r.categoria || 'Operativo', proveedorId: r.proveedorId || '', metodoPago: r.metodoPago || 'Efectivo', subtotal,
      iva, total: num_(r.total || subtotal + iva), estatus: r.estatus || 'Pagado', notas: r.notas || '', createdAt: now_()
    };
  }
  if (entity === 'movements') {
    const product = findProductBySku_(r.sku);
    const qty = num_(r.cantidad);
    const unitCost = num_(r.costoUnitario || (product ? product.costoUnitario : 0));
    return {
      id: newId_('MOV'), fecha: r.fecha || today, tipo: r.tipo || 'Ajuste inventario', sku: r.sku || '', producto: product ? product.nombre : (r.producto || ''), cantidad: qty,
      costoUnitario: unitCost, impactoCosto: round_(qty * unitCost), motivo: r.motivo || '', referencia: r.referencia || '', usuario: r.usuario || 'USR-001', createdAt: now_()
    };
  }
  if (entity === 'products') {
    return {
      id: newId_('PROD'), sku: r.sku || newId_('SKU'), nombre: r.nombre || 'Producto nuevo', categoria: r.categoria || 'General', unidad: r.unidad || 'pz', proveedorId: r.proveedorId || '',
      costoUnitario: num_(r.costoUnitario), precioVenta: num_(r.precioVenta), stockActual: num_(r.stockActual), stockMinimo: num_(r.stockMinimo || 10), iva: num_(r.iva || 0.16), estatus: r.estatus || 'Activo', updatedAt: now_()
    };
  }
  throw new Error('Normalización no implementada para: ' + entity);
}

function getDashboardSummary_(payload) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('summary');
  if (cached && !payload.noCache) return JSON.parse(cached);

  const sales = readSheetObjects_(SHEETS.SALES);
  const expenses = readSheetObjects_(SHEETS.EXPENSES);
  const products = readSheetObjects_(SHEETS.PRODUCTS);
  const movements = readSheetObjects_(SHEETS.MOVEMENTS);
  const purchases = readSheetObjects_(SHEETS.PURCHASES);

  const monthKey = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM');
  const salesMonth = sales.filter(r => String(r.fecha || '').slice(0, 7) === monthKey && r.estatus !== 'Cancelado');
  const expensesMonth = expenses.filter(r => String(r.fecha || '').slice(0, 7) === monthKey && r.estatus !== 'Cancelado');

  const revenue = sum_(salesMonth, 'total');
  const cost = sum_(salesMonth, 'costoVenta');
  const profit = revenue - cost;
  const expensesTotal = sum_(expensesMonth, 'total');
  const netProfit = profit - expensesTotal;
  const avgTicket = salesMonth.length ? revenue / salesMonth.length : 0;
  const inventoryCost = products.reduce((acc, p) => acc + num_(p.stockActual) * num_(p.costoUnitario), 0);
  const lowStock = products.filter(p => num_(p.stockActual) <= num_(p.stockMinimo));
  const pendingPayables = purchases.filter(p => p.estatusPago === 'Pendiente').reduce((acc, p) => acc + num_(p.total), 0);

  const byDay = groupByDate_(sales, 'fecha', 'total', 14);
  const expensesByCategory = topGroup_(expensesMonth, 'categoria', 'total', 8);
  const topProductsRisk = lowStock.map(p => ({ sku: p.sku, nombre: p.nombre, stockActual: num_(p.stockActual), stockMinimo: num_(p.stockMinimo) }));
  const movementsToday = movements.filter(m => String(m.fecha) === Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'));

  const result = {
    success: true,
    store: { name: CONFIG.STORE_NAME, currency: 'MXN', month: monthKey },
    kpis: {
      revenue: round_(revenue),
      grossProfit: round_(profit),
      grossMargin: revenue ? round_(profit / revenue) : 0,
      expenses: round_(expensesTotal),
      netProfit: round_(netProfit),
      avgTicket: round_(avgTicket),
      inventoryCost: round_(inventoryCost),
      lowStockCount: lowStock.length,
      pendingPayables: round_(pendingPayables),
      salesCount: salesMonth.length,
      movementsToday: movementsToday.length
    },
    charts: { salesByDay: byDay, expensesByCategory },
    alerts: topProductsRisk,
    recent: {
      sales: sales.slice(-8).reverse(),
      expenses: expenses.slice(-8).reverse(),
      movements: movements.slice(-8).reverse()
    }
  };
  cache.put('summary', JSON.stringify(result), 30);
  return result;
}

function entityToSheet_() {
  return {
    products: SHEETS.PRODUCTS,
    sales: SHEETS.SALES,
    expenses: SHEETS.EXPENSES,
    movements: SHEETS.MOVEMENTS,
    suppliers: SHEETS.SUPPLIERS,
    customers: SHEETS.CUSTOMERS,
    purchases: SHEETS.PURCHASES,
    users: SHEETS.USERS,
    budgets: SHEETS.BUDGETS
  };
}

function readSheetObjects_(sheetName) {
  const sh = ss_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendObject_(sheetName, obj) {
  const sh = ss_().getSheetByName(sheetName);
  const headers = SCHEMA[sheetName];
  sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function findProductBySku_(sku) {
  if (!sku) return null;
  return readSheetObjects_(SHEETS.PRODUCTS).find(p => String(p.sku).trim() === String(sku).trim()) || null;
}

function updateStockFromMovement_(movement) {
  if (!movement.sku) return;
  const sh = ss_().getSheetByName(SHEETS.PRODUCTS);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const skuCol = headers.indexOf('sku') + 1;
  const stockCol = headers.indexOf('stockActual') + 1;
  const updatedAtCol = headers.indexOf('updatedAt') + 1;
  for (let r = 2; r <= data.length; r++) {
    if (String(sh.getRange(r, skuCol).getValue()).trim() === String(movement.sku).trim()) {
      const current = num_(sh.getRange(r, stockCol).getValue());
      sh.getRange(r, stockCol).setValue(current + num_(movement.cantidad));
      sh.getRange(r, updatedAtCol).setValue(now_());
      return;
    }
  }
}

function groupByDate_(rows, dateKey, valueKey, daysBack) {
  const map = {};
  const today = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd');
    map[key] = 0;
  }
  rows.forEach(r => {
    const key = String(r[dateKey] || '').slice(0, 10);
    if (Object.prototype.hasOwnProperty.call(map, key)) map[key] += num_(r[valueKey]);
  });
  return Object.keys(map).map(date => ({ date, value: round_(map[date]) }));
}

function topGroup_(rows, groupKey, valueKey, limit) {
  const map = {};
  rows.forEach(r => {
    const key = String(r[groupKey] || 'Sin categoría');
    map[key] = (map[key] || 0) + num_(r[valueKey]);
  });
  return Object.keys(map).map(k => ({ label: k, value: round_(map[k]) })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function sum_(rows, key) {
  return rows.reduce((acc, r) => acc + num_(r[key]), 0);
}

function num_(v) {
  const n = Number(v || 0);
  return isNaN(n) ? 0 : n;
}

function round_(n) {
  return Math.round(num_(n) * 100) / 100;
}

function pad_(n, len) {
  return String(n).padStart(len, '0');
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

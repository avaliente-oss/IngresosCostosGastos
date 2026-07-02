const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const APP_CONFIG = Object.freeze({
  APP_NAME: 'MercadoOS Admin',
  STORE_NAME: 'Supermercado La Central',
  API_URL: '',
  DEMO_PIN: '',
  AUTO_CONNECT: false,
  ALLOW_MANUAL_CONNECTION: true,
  ...(window.APP_CONFIG || {})
});

const STORAGE_KEYS = {
  apiUrl: 'mercadoos.apiUrl',
  pin: 'mercadoos.pin',
  manualMode: 'mercadoos.manualMode'
};

const viewMeta = {
  home: {
    title: 'Inicio operativo',
    subtitle: 'Centro de trabajo para controlar la jornada administrativa.'
  },
  cash: {
    title: 'Caja e ingresos',
    subtitle: 'Captura ventas y revisa los ingresos recientes de la operación.'
  },
  inventory: {
    title: 'Inventario',
    subtitle: 'Control de catálogo, precios, costos, existencias y puntos mínimos.'
  },
  purchases: {
    title: 'Compras y cuentas por pagar',
    subtitle: 'Seguimiento de facturas, proveedores y pagos pendientes.'
  },
  expenses: {
    title: 'Gastos',
    subtitle: 'Registro de egresos operativos por categoría y estatus.'
  },
  movements: {
    title: 'Movimientos de inventario',
    subtitle: 'Bitácora de entradas, salidas, ajustes, mermas y traspasos.'
  },
  suppliers: {
    title: 'Proveedores',
    subtitle: 'Directorio comercial para compras y condiciones de crédito.'
  },
  settings: {
    title: 'Conexión',
    subtitle: 'Configuración técnica para conectar GitHub Pages con Apps Script.'
  }
};

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('es-MX');
const percent = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 });
const dateLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const timeShort = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });

const initialConnection = getInitialConnection();

const state = {
  view: 'home',
  apiUrl: initialConnection.apiUrl,
  pin: initialConnection.pin,
  usingDefaultConfig: initialConnection.usingDefaultConfig,
  summary: null,
  installPrompt: null,
  local: buildLocalDemo()
};

boot();

function boot() {
  initBranding();
  bindNavigation();
  bindForms();
  bindInstall();
  registerServiceWorker();
  setTodayDefaults();
  updateClock();
  setInterval(updateClock, 30000);
  updateConnectionUi();
  renderConfigStatus();
  loadHome(true).catch(error => toast(error.message, true));
}

function initBranding() {
  document.title = APP_CONFIG.APP_NAME || 'MercadoOS Admin';
  $('#appName').textContent = (APP_CONFIG.APP_NAME || 'MercadoOS Admin').replace(' Admin', '');
  $('#storeName').textContent = APP_CONFIG.STORE_NAME || 'Supermercado La Central';
}

function getInitialConnection() {
  applyUrlProvisioning();
  const manualMode = localStorage.getItem(STORAGE_KEYS.manualMode) === 'true';
  const savedApiUrl = localStorage.getItem(STORAGE_KEYS.apiUrl);
  const savedPin = localStorage.getItem(STORAGE_KEYS.pin);
  const shouldUseConfig = APP_CONFIG.AUTO_CONNECT && !manualMode;
  return {
    apiUrl: savedApiUrl || (shouldUseConfig ? APP_CONFIG.API_URL : ''),
    pin: savedPin || (shouldUseConfig ? APP_CONFIG.DEMO_PIN : ''),
    usingDefaultConfig: Boolean(!savedApiUrl && shouldUseConfig && APP_CONFIG.API_URL)
  };
}

function applyUrlProvisioning() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === '1') {
    localStorage.removeItem(STORAGE_KEYS.apiUrl);
    localStorage.removeItem(STORAGE_KEYS.pin);
    localStorage.removeItem(STORAGE_KEYS.manualMode);
    history.replaceState({}, '', window.location.pathname);
    return;
  }
  const apiUrl = params.get('apiUrl') || params.get('api');
  const pin = params.get('pin') || params.get('token');
  if (apiUrl) localStorage.setItem(STORAGE_KEYS.apiUrl, apiUrl.trim());
  if (pin) localStorage.setItem(STORAGE_KEYS.pin, pin.trim());
  if (apiUrl || pin) {
    localStorage.setItem(STORAGE_KEYS.manualMode, 'true');
    history.replaceState({}, '', window.location.pathname);
  }
}

function bindNavigation() {
  $$('.module-link').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $$('[data-view-target]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.viewTarget)));
  $('#refreshBtn').addEventListener('click', () => refreshCurrentView(true));
  $('#newProductBtn')?.addEventListener('click', () => $('#productDrawer').hidden = false);
  $('#closeProductDrawer')?.addEventListener('click', () => $('#productDrawer').hidden = true);
}

function bindForms() {
  const settingsForm = $('#settingsForm');
  settingsForm.elements.apiUrl.value = state.apiUrl;
  settingsForm.elements.pin.value = state.pin;

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.apiUrl = String(form.get('apiUrl') || '').trim();
    state.pin = String(form.get('pin') || '').trim();
    state.usingDefaultConfig = false;
    localStorage.setItem(STORAGE_KEYS.apiUrl, state.apiUrl);
    localStorage.setItem(STORAGE_KEYS.pin, state.pin);
    localStorage.setItem(STORAGE_KEYS.manualMode, 'true');
    updateConnectionUi();
    renderConfigStatus();
    await testConnection();
  });

  $('#restoreDefaultSettingsBtn').addEventListener('click', async () => {
    state.apiUrl = APP_CONFIG.API_URL || '';
    state.pin = APP_CONFIG.DEMO_PIN || '';
    state.usingDefaultConfig = Boolean(APP_CONFIG.API_URL);
    localStorage.removeItem(STORAGE_KEYS.apiUrl);
    localStorage.removeItem(STORAGE_KEYS.pin);
    localStorage.removeItem(STORAGE_KEYS.manualMode);
    settingsForm.elements.apiUrl.value = state.apiUrl;
    settingsForm.elements.pin.value = state.pin;
    updateConnectionUi();
    renderConfigStatus();
    if (state.apiUrl) await testConnection();
    else toast('No hay API_URL configurado en config.js.', true);
  });

  $('#clearSettingsBtn').addEventListener('click', () => {
    state.apiUrl = '';
    state.pin = '';
    state.usingDefaultConfig = false;
    localStorage.removeItem(STORAGE_KEYS.apiUrl);
    localStorage.removeItem(STORAGE_KEYS.pin);
    localStorage.setItem(STORAGE_KEYS.manualMode, 'true');
    settingsForm.elements.apiUrl.value = '';
    settingsForm.elements.pin.value = '';
    updateConnectionUi();
    renderConfigStatus();
    toast('Demo local activada en este dispositivo.');
    refreshCurrentView(true);
  });

  $('#seedBackendBtn').addEventListener('click', async () => {
    try {
      const result = await api('initDemo', {});
      $('#connectionTest').textContent = result.message || 'Datos dummy cargados.';
      toast('Base demo cargada en Google Sheets.');
      await refreshCurrentView(true);
    } catch (error) {
      $('#connectionTest').textContent = error.message;
      toast(error.message, true);
    }
  });

  $('#saleForm').addEventListener('submit', submitRecord('sales', 'Ingreso guardado.'));
  $('#expenseForm').addEventListener('submit', submitRecord('expenses', 'Gasto guardado.'));
  $('#movementForm').addEventListener('submit', submitRecord('movements', 'Movimiento guardado.'));
  $('#productForm').addEventListener('submit', submitRecord('products', 'Producto guardado.'));
}

function bindInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $('#installBtn').hidden = false;
  });

  $('#installBtn').addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('#installBtn').hidden = true;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => null);
  }
}

function updateClock() {
  const now = new Date();
  $('#currentDateLabel').textContent = titleCase(dateLong.format(now));
  $('#currentTimeLabel').textContent = `${timeShort.format(now)} · Hora local`;
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  ['saleForm', 'expenseForm', 'movementForm'].forEach(id => {
    const input = $(`#${id} input[name="fecha"]`);
    if (input) input.value = today;
  });
}

function setView(view) {
  state.view = view;
  $$('.screen').forEach(section => section.classList.toggle('active-screen', section.id === view));
  $$('.module-link').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  const meta = viewMeta[view] || viewMeta.home;
  $('#viewTitle').textContent = meta.title;
  $('#viewSubtitle').textContent = meta.subtitle;
  refreshCurrentView(false).catch(error => toast(error.message, true));
}

async function refreshCurrentView(force = false) {
  if (state.view === 'home') await loadHome(force);
  if (state.view === 'cash') await loadSales();
  if (state.view === 'inventory') await loadInventory();
  if (state.view === 'purchases') await loadPurchases();
  if (state.view === 'expenses') await loadExpenses();
  if (state.view === 'movements') await loadMovements();
  if (state.view === 'suppliers') await loadSuppliers();
}

async function loadHome(force = false) {
  const data = await api('summary', { noCache: force });
  state.summary = data;
  renderHome(data);
  updateConnectionUi();
}

function renderHome(data) {
  $('#storeName').textContent = data.store?.name || APP_CONFIG.STORE_NAME || 'Supermercado La Central';
  const k = data.kpis || {};
  const operationCards = [
    {
      label: 'Ingresos del mes',
      value: money.format(k.revenue || 0),
      text: `${number.format(k.salesCount || 0)} tickets capturados`,
      tone: 'good'
    },
    {
      label: 'Gastos registrados',
      value: money.format(k.expenses || 0),
      text: 'Egresos operativos acumulados',
      tone: (k.expenses || 0) > (k.revenue || 0) * .35 ? 'warn' : ''
    },
    {
      label: 'Inventario valorizado',
      value: money.format(k.inventoryCost || 0),
      text: 'Costo aproximado en anaquel',
      tone: ''
    },
    {
      label: 'Pendientes críticos',
      value: number.format((k.lowStockCount || 0) + (k.pendingPayables ? 1 : 0)),
      text: 'Stock bajo y cuentas por pagar',
      tone: (k.lowStockCount || 0) ? 'bad' : 'good'
    }
  ];

  $('#operationsGrid').innerHTML = operationCards.map(card => `
    <article class="operation-card ${card.tone}">
      <small>${escapeHtml(card.label)}</small>
      <strong>${escapeHtml(card.value)}</strong>
      <span>${escapeHtml(card.text)}</span>
    </article>
  `).join('');

  const actions = buildActions(data);
  $('#actionList').innerHTML = actions.map(action => `
    <div class="action-row">
      <i class="action-status ${action.tone}"></i>
      <div>
        <strong>${escapeHtml(action.title)}</strong>
        <p>${escapeHtml(action.text)}</p>
      </div>
      <button data-view-target="${action.view}">${escapeHtml(action.cta)}</button>
    </div>
  `).join('');
  $$('[data-view-target]', $('#actionList')).forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.viewTarget)));

  $('#businessState').innerHTML = [
    ['Margen bruto estimado', percent.format(k.grossMargin || 0)],
    ['Utilidad neta del mes', money.format(k.netProfit || 0)],
    ['Ticket promedio', money.format(k.avgTicket || 0)],
    ['Cuentas por pagar', money.format(k.pendingPayables || 0)],
    ['Movimientos de hoy', number.format(k.movementsToday || 0)]
  ].map(([label, value]) => `
    <div class="state-item"><span>${label}</span><strong>${value}</strong></div>
  `).join('');

  renderTable('#homeMovementsTable', data.recent?.movements || [], tableColumns('movements'), { empty: 'Sin movimientos recientes.' });
}

function buildActions(data) {
  const k = data.kpis || {};
  const actions = [];
  if ((k.lowStockCount || 0) > 0) {
    actions.push({
      title: 'Revisar productos por debajo del mínimo',
      text: `${number.format(k.lowStockCount)} productos requieren reorden o ajuste de existencias.`,
      cta: 'Atender',
      view: 'inventory',
      tone: 'bad'
    });
  }
  if ((k.pendingPayables || 0) > 0) {
    actions.push({
      title: 'Validar cuentas por pagar',
      text: `Hay ${money.format(k.pendingPayables)} en compras pendientes de pago.`,
      cta: 'Revisar',
      view: 'purchases',
      tone: 'warn'
    });
  }
  actions.push({
    title: 'Registrar venta o ingreso nuevo',
    text: 'Captura la operación del día para mantener la administración actualizada.',
    cta: 'Capturar',
    view: 'cash',
    tone: 'good'
  });
  actions.push({
    title: 'Registrar merma, entrada o ajuste de almacén',
    text: 'Mantén el inventario real alineado con el inventario administrativo.',
    cta: 'Abrir',
    view: 'movements',
    tone: ''
  });
  return actions.slice(0, 5);
}

async function loadSales() {
  const result = await api('list', { entity: 'sales', limit: 120 });
  $('#salesCounter').textContent = `${number.format(result.data?.length || 0)} registros`;
  renderTable('#salesTable', result.data || [], tableColumns('sales'));
}

async function loadInventory() {
  const result = await api('list', { entity: 'products', limit: 250 });
  const products = result.data || [];
  $('#productsCounter').textContent = `${number.format(products.length)} productos`;
  renderInventoryStatus(products);
  renderTable('#inventoryTable', products, tableColumns('products'));
}

function renderInventoryStatus(products) {
  const low = products.filter(p => Number(p.stockActual || 0) <= Number(p.stockMinimo || 0));
  const active = products.filter(p => String(p.estatus || '').toLowerCase() !== 'inactivo');
  const inventoryCost = products.reduce((acc, p) => acc + Number(p.stockActual || 0) * Number(p.costoUnitario || 0), 0);
  $('#inventoryStatus').innerHTML = [
    ['Productos activos', number.format(active.length)],
    ['Stock bajo', number.format(low.length)],
    ['Valor en costo', money.format(inventoryCost)]
  ].map(([label, value]) => `<div class="mini-state"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

async function loadPurchases() {
  const result = await api('list', { entity: 'purchases', limit: 120 });
  const rows = result.data || [];
  $('#purchasesCounter').textContent = `${number.format(rows.length)} registros`;
  const pending = rows.filter(r => /pendiente/i.test(String(r.estatusPago || '')));
  const pendingTotal = pending.reduce((acc, row) => acc + Number(row.total || 0), 0);
  const paidTotal = rows.filter(r => /pagado/i.test(String(r.estatusPago || ''))).reduce((acc, row) => acc + Number(row.total || 0), 0);
  $('#payablesSummary').innerHTML = [
    ['Facturas pendientes', number.format(pending.length)],
    ['Saldo por pagar', money.format(pendingTotal)],
    ['Compras pagadas', money.format(paidTotal)]
  ].map(([label, value]) => `<div class="mini-state"><span>${label}</span><strong>${value}</strong></div>`).join('');
  renderTable('#purchasesTable', rows, tableColumns('purchases'));
}

async function loadExpenses() {
  const result = await api('list', { entity: 'expenses', limit: 120 });
  $('#expensesCounter').textContent = `${number.format(result.data?.length || 0)} registros`;
  renderTable('#expensesTable', result.data || [], tableColumns('expenses'));
}

async function loadMovements() {
  const result = await api('list', { entity: 'movements', limit: 150 });
  $('#movementsCounter').textContent = `${number.format(result.data?.length || 0)} registros`;
  renderTable('#movementsTable', result.data || [], tableColumns('movements'));
}

async function loadSuppliers() {
  const result = await api('list', { entity: 'suppliers', limit: 120 });
  const suppliers = result.data || [];
  $('#suppliersCounter').textContent = `${number.format(suppliers.length)} proveedores`;
  $('#supplierCards').innerHTML = suppliers.length ? suppliers.map(s => `
    <article class="supplier-card">
      <strong>${escapeHtml(s.nombre || 'Proveedor')}</strong>
      <span>${escapeHtml(s.categoria || 'General')}</span>
      <p><b>Contacto:</b> ${escapeHtml(s.contacto || '—')}</p>
      <p><b>Teléfono:</b> ${escapeHtml(s.telefono || '—')}</p>
      <p><b>Crédito:</b> ${escapeHtml(s.diasCredito || 0)} días</p>
    </article>
  `).join('') : '<p class="muted">Sin proveedores registrados.</p>';
}

function tableColumns(entity) {
  const cols = {
    sales: [['fecha','Fecha'],['folio','Folio'],['canal','Canal'],['metodoPago','Pago'],['subtotal','Subtotal'],['total','Total'],['utilidad','Utilidad'],['estatus','Estatus']],
    expenses: [['fecha','Fecha'],['categoria','Categoría'],['proveedorId','Proveedor'],['metodoPago','Pago'],['total','Total'],['estatus','Estatus'],['notas','Notas']],
    products: [['sku','SKU'],['nombre','Producto'],['categoria','Categoría'],['unidad','Unidad'],['costoUnitario','Costo'],['precioVenta','Precio'],['stockActual','Stock'],['stockMinimo','Mínimo'],['estatus','Estatus']],
    movements: [['fecha','Fecha'],['tipo','Tipo'],['sku','SKU'],['producto','Producto'],['cantidad','Cantidad'],['impactoCosto','Impacto'],['motivo','Motivo'],['usuario','Usuario']],
    purchases: [['fecha','Fecha'],['folio','Factura'],['proveedorId','Proveedor'],['total','Total'],['estatusPago','Estatus'],['fechaVencimiento','Vence'],['notas','Notas']]
  };
  return cols[entity] || [];
}

function renderTable(selector, rows, columns, options = {}) {
  const table = $(selector);
  if (!table) return;
  if (!rows.length) {
    table.innerHTML = `<tbody><tr><td>${options.empty || 'Sin datos para mostrar.'}</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `
    <thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(row => `<tr>${columns.map(([key]) => `<td>${formatCell(key, row[key], row)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  `;
}

function formatCell(key, value, row = {}) {
  if (value === undefined || value === null || value === '') return '<span class="muted">—</span>';
  if (['total','subtotal','iva','descuento','utilidad','costoVenta','costoUnitario','precioVenta','impactoCosto'].includes(key)) {
    const cls = key === 'impactoCosto' && Number(value) < 0 ? 'money-neg' : key === 'utilidad' ? 'money-pos' : '';
    return `<span class="${cls}">${money.format(Number(value || 0))}</span>`;
  }
  if (key === 'stockActual') {
    const low = Number(value || 0) <= Number(row.stockMinimo || 0);
    return `<span class="stock-chip ${low ? 'low' : ''}">${number.format(Number(value || 0))}</span>`;
  }
  if (['estatus','estatusPago'].includes(key)) {
    const v = String(value);
    const cls = /pendiente/i.test(v) ? 'pending' : /cancelado|bajo|merma/i.test(v) ? 'danger' : '';
    return `<span class="status-pill ${cls}">${escapeHtml(v)}</span>`;
  }
  return escapeHtml(value);
}

function submitRecord(entity, successMessage) {
  return async (event) => {
    event.preventDefault();
    const record = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api('create', { entity, record });
      event.currentTarget.reset();
      setTodayDefaults();
      if (entity === 'products') $('#productDrawer').hidden = true;
      toast(successMessage || 'Registro guardado.');
      await refreshCurrentView(true);
    } catch (error) {
      toast(error.message, true);
    }
  };
}

async function testConnection() {
  const box = $('#connectionTest');
  box.textContent = 'Probando conexión...';
  try {
    const data = await api('ping', {});
    box.textContent = `${data.message}. Tienda: ${data.storeName || 'Demo'} · Versión ${data.version || ''}`;
    toast('Conexión correcta con Apps Script.');
    await refreshCurrentView(true);
  } catch (error) {
    box.textContent = `No se pudo conectar: ${error.message}`;
    toast(error.message, true);
  }
}

function renderConfigStatus() {
  const box = $('#configStatus');
  if (!box) return;
  if (APP_CONFIG.API_URL) {
    box.innerHTML = state.usingDefaultConfig
      ? 'Conexión automática activa desde <code>config.js</code>. El usuario no necesita pegar URL ni PIN.'
      : 'Existe una conexión preconfigurada en <code>config.js</code>. Puedes restaurarla cuando quieras.';
  } else {
    box.innerHTML = 'Todavía no hay backend preconfigurado. Edita <code>frontend/config.js</code> antes de publicar la demo en GitHub Pages.';
  }
}

async function api(action, payload = {}) {
  if (!state.apiUrl) return localApi(action, payload);
  const response = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ pin: state.pin, action, payload }),
    redirect: 'follow'
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('La API no regresó JSON válido. Revisa que uses el URL terminado en /exec y que el deployment permita acceso.');
  }
  if (!data.success) throw new Error(data.message || 'Error desconocido del backend.');
  return data;
}

function updateConnectionUi() {
  const connected = Boolean(state.apiUrl);
  $('#connectionMode').textContent = connected ? 'Google Sheets conectado' : 'Demo local';
  $('#connectionDescription').textContent = connected
    ? (state.usingDefaultConfig ? 'Conexión automática desde config.js.' : 'Conexión personalizada guardada en este dispositivo.')
    : 'La app funciona con datos locales hasta conectar backend.';
}

function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.style.background = isError ? '#b42318' : '#111827';
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.hidden = true, 3800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
}

function titleCase(value) {
  return String(value).replace(/^./, char => char.toUpperCase());
}

function buildLocalDemo() {
  const today = new Date();
  const suppliers = [
    { id:'SUP-001', nombre:'Abarrotes del Centro', categoria:'Abarrotes', contacto:'María López', telefono:'222-100-1001', email:'ventas@abarrotescentro.mx', diasCredito:15, estatus:'Activo' },
    { id:'SUP-002', nombre:'Lácteos Puebla', categoria:'Lácteos', contacto:'Jorge Morales', telefono:'222-100-1002', email:'pedidos@lacteospuebla.mx', diasCredito:7, estatus:'Activo' },
    { id:'SUP-003', nombre:'Carnes Selectas MX', categoria:'Carnes', contacto:'Daniela Vega', telefono:'222-100-1003', email:'contacto@carnesselectas.mx', diasCredito:10, estatus:'Activo' },
    { id:'SUP-004', nombre:'Frutas San Miguel', categoria:'Frutas y verduras', contacto:'Roberto Ruiz', telefono:'222-100-1004', email:'compras@frutassanmi.mx', diasCredito:5, estatus:'Activo' },
    { id:'SUP-005', nombre:'Limpieza Pro Hogar', categoria:'Limpieza', contacto:'Andrea Santos', telefono:'222-100-1005', email:'ventas@prohogar.mx', diasCredito:20, estatus:'Activo' }
  ];
  const products = [
    { id:'PROD-001', sku:'SKU-ARZ-001', nombre:'Arroz 1 kg', categoria:'Abarrotes', unidad:'pz', proveedorId:'SUP-001', costoUnitario:18.5, precioVenta:29, stockActual:128, stockMinimo:35, estatus:'Activo' },
    { id:'PROD-002', sku:'SKU-FRJ-001', nombre:'Frijol negro 900 g', categoria:'Abarrotes', unidad:'pz', proveedorId:'SUP-001', costoUnitario:22, precioVenta:35, stockActual:94, stockMinimo:30, estatus:'Activo' },
    { id:'PROD-004', sku:'SKU-LEC-001', nombre:'Leche entera 1 L', categoria:'Lácteos', unidad:'pz', proveedorId:'SUP-002', costoUnitario:18, precioVenta:27, stockActual:36, stockMinimo:45, estatus:'Activo' },
    { id:'PROD-007', sku:'SKU-POL-001', nombre:'Pechuga pollo kg', categoria:'Carnes', unidad:'kg', proveedorId:'SUP-003', costoUnitario:78, precioVenta:118, stockActual:18, stockMinimo:15, estatus:'Activo' },
    { id:'PROD-008', sku:'SKU-RES-001', nombre:'Carne molida kg', categoria:'Carnes', unidad:'kg', proveedorId:'SUP-003', costoUnitario:105, precioVenta:159, stockActual:12, stockMinimo:12, estatus:'Activo' },
    { id:'PROD-011', sku:'SKU-DET-001', nombre:'Detergente 1 kg', categoria:'Limpieza', unidad:'pz', proveedorId:'SUP-005', costoUnitario:34, precioVenta:59, stockActual:29, stockMinimo:20, estatus:'Activo' }
  ];
  const sales = Array.from({ length: 32 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const subtotal = 650 + (i % 9) * 420;
    const iva = subtotal * 0.10;
    const total = subtotal + iva;
    const costoVenta = total * 0.66;
    return { id:`VEN-${i+1}`, fecha: toDate(d), folio:`TCK-${1000+i}`, canal:['Mostrador','WhatsApp','Domicilio','Mayoreo'][i%4], metodoPago:['Efectivo','Tarjeta','Transferencia'][i%3], subtotal, descuento:0, iva, total, costoVenta, utilidad: total - costoVenta, estatus:'Cobrado' };
  });
  const expenses = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - i * 2);
    const subtotal = 380 + (i % 7) * 530;
    return { id:`GAS-${i+1}`, fecha: toDate(d), categoria:['Renta','Nómina','Luz','Marketing','Merma','Transporte'][i%6], proveedorId:`SUP-00${(i%5)+1}`, metodoPago:['Efectivo','Tarjeta','Transferencia'][i%3], subtotal, iva: subtotal*.16, total: subtotal*1.16, estatus: i%5?'Pagado':'Pendiente', notas:'' };
  });
  const movements = Array.from({ length: 28 }, (_, i) => {
    const p = products[i % products.length];
    const d = new Date(today); d.setDate(today.getDate() - Math.floor(i / 2));
    const cantidad = i % 3 === 0 ? 20 : -((i % 5) + 1);
    return { id:`MOV-${i+1}`, fecha:toDate(d), tipo: i%3 === 0 ? 'Entrada compra' : 'Salida venta', sku:p.sku, producto:p.nombre, cantidad, costoUnitario:p.costoUnitario, impactoCosto:cantidad*p.costoUnitario, motivo:'Demo local', usuario:'USR-001' };
  });
  const purchases = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - i * 3);
    const subtotal = 1800 + (i % 6) * 1300;
    const due = new Date(d); due.setDate(d.getDate() + [5,7,10,15][i % 4]);
    return { id:`COM-${i+1}`, fecha:toDate(d), folio:`FAC-${3000+i}`, proveedorId:`SUP-00${(i%5)+1}`, subtotal, iva: subtotal*.08, total: subtotal*1.08, estatusPago: i%4 === 0 ? 'Pendiente' : 'Pagado', fechaVencimiento: toDate(due), notas:'' };
  });
  return { products, sales, expenses, movements, purchases, suppliers };
}

function localApi(action, payload) {
  const db = state.local;
  if (action === 'ping') return Promise.resolve({ success:true, message:'Demo local activa', storeName:APP_CONFIG.STORE_NAME || 'Supermercado La Central', version:'local' });
  if (action === 'initDemo') return Promise.resolve({ success:true, message:'En modo local no se cargan datos en Sheets.' });
  if (action === 'list') {
    const entity = payload.entity;
    const data = [...(db[entity] || [])].sort((a, b) => String(b.fecha || b.createdAt || '').localeCompare(String(a.fecha || a.createdAt || ''))).slice(0, payload.limit || 100);
    return Promise.resolve({ success:true, entity, count:data.length, data });
  }
  if (action === 'create') {
    const entity = payload.entity;
    const record = normalizeLocalRecord(entity, payload.record || {});
    if (!db[entity]) db[entity] = [];
    db[entity].push(record);
    if (entity === 'movements') updateLocalStock(record);
    return Promise.resolve({ success:true, entity, data:record });
  }
  return Promise.resolve(localSummary());
}

function normalizeLocalRecord(entity, record) {
  const base = { id: `${entity.slice(0, 3).toUpperCase()}-${Date.now()}`, createdAt: new Date().toISOString() };
  if (entity === 'sales') {
    const subtotal = Number(record.subtotal || 0);
    const descuento = Number(record.descuento || 0);
    const iva = (subtotal - descuento) * .16;
    const total = subtotal - descuento + iva;
    const costoVenta = total * .65;
    return { ...base, fecha: record.fecha || toDate(new Date()), folio: `TCK-${Date.now().toString().slice(-5)}`, canal: record.canal || 'Mostrador', metodoPago: record.metodoPago || 'Efectivo', subtotal, descuento, iva, total, costoVenta, utilidad: total - costoVenta, estatus:'Cobrado', notas: record.notas || '' };
  }
  if (entity === 'expenses') {
    const subtotal = Number(record.subtotal || 0);
    return { ...base, fecha: record.fecha || toDate(new Date()), categoria: record.categoria || 'Operativo', proveedorId: record.proveedorId || '', metodoPago: record.metodoPago || 'Efectivo', subtotal, iva: subtotal * .16, total: subtotal * 1.16, estatus: record.estatus || 'Pagado', notas: record.notas || '' };
  }
  if (entity === 'movements') {
    const product = dbFindProduct(record.sku);
    const cantidad = Number(record.cantidad || 0);
    const costoUnitario = Number(record.costoUnitario || product?.costoUnitario || 0);
    return { ...base, fecha: record.fecha || toDate(new Date()), tipo: record.tipo || 'Ajuste inventario', sku: record.sku || '', producto: product?.nombre || record.producto || '', cantidad, costoUnitario, impactoCosto: cantidad * costoUnitario, motivo: record.motivo || '', usuario:'USR-001' };
  }
  if (entity === 'products') {
    return { ...base, sku: record.sku || `SKU-${Date.now()}`, nombre: record.nombre || 'Producto nuevo', categoria: record.categoria || 'General', unidad: record.unidad || 'pz', costoUnitario: Number(record.costoUnitario || 0), precioVenta: Number(record.precioVenta || 0), stockActual: Number(record.stockActual || 0), stockMinimo: Number(record.stockMinimo || 10), estatus:'Activo' };
  }
  return { ...base, ...record };
}

function dbFindProduct(sku) {
  return state.local.products.find(p => String(p.sku).trim() === String(sku || '').trim());
}

function updateLocalStock(movement) {
  const product = dbFindProduct(movement.sku);
  if (product) product.stockActual = Number(product.stockActual || 0) + Number(movement.cantidad || 0);
}

function localSummary() {
  const db = state.local;
  const revenue = sum(db.sales, 'total');
  const cost = sum(db.sales, 'costoVenta');
  const grossProfit = revenue - cost;
  const expenses = sum(db.expenses, 'total');
  const inventoryCost = db.products.reduce((acc, p) => acc + Number(p.stockActual || 0) * Number(p.costoUnitario || 0), 0);
  const lowStock = db.products.filter(p => Number(p.stockActual || 0) <= Number(p.stockMinimo || 0));
  const pendingPayables = db.purchases.filter(p => /pendiente/i.test(String(p.estatusPago || ''))).reduce((acc, p) => acc + Number(p.total || 0), 0);
  const today = toDate(new Date());
  return {
    success:true,
    store:{ name:APP_CONFIG.STORE_NAME || 'Supermercado La Central', currency:'MXN', month:new Date().toISOString().slice(0,7) },
    kpis:{ revenue, grossProfit, grossMargin: revenue ? grossProfit / revenue : 0, expenses, netProfit:grossProfit - expenses, avgTicket: revenue / Math.max(db.sales.length, 1), inventoryCost, lowStockCount:lowStock.length, pendingPayables, salesCount:db.sales.length, movementsToday: db.movements.filter(m => m.fecha === today).length },
    alerts:lowStock,
    recent:{ sales:db.sales.slice(-8).reverse(), expenses:db.expenses.slice(-8).reverse(), movements:db.movements.slice(-8).reverse() }
  };
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function toDate(d) {
  return d.toISOString().slice(0, 10);
}

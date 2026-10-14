/**
 * Margen DataBridge - Frontend Controller
 * Con soporte para Listas de Precios estándar y Reportes Multisección (AgendaPro / Servicios + Egresos)
 */

// Estado global de la aplicación
const state = {
  currentFile: null,
  excelData: null,
  products: [],
  expenses: [],
  pAndLSummary: null,
  isMultiSection: false,
  currentViewMode: 'services', // 'services' | 'expenses' | 'pl'
  summary: null,
  activeFilter: 'ALL',
  searchQuery: ''
};

// Formateador monetario (ARS)
const formatMoney = (val) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val || 0);
};

// Notificación Toast
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';
  if (type === 'danger') toast.style.borderLeftColor = 'var(--danger)';
  else if (type === 'warning') toast.style.borderLeftColor = 'var(--warning)';
  else toast.style.borderLeftColor = 'var(--primary)';

  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

// Inicialización de Pestañas
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Snippets de código en Tab API
  const codeBtns = document.querySelectorAll('.code-tab-btn');
  codeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      codeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.getElementById('code-curl').style.display = lang === 'curl' ? 'block' : 'none';
      document.getElementById('code-js').style.display = lang === 'js' ? 'block' : 'none';
      document.getElementById('code-python').style.display = lang === 'python' ? 'block' : 'none';
    });
  });
}

// Inicialización de Dropzone
function initDropzone() {
  const dropzone = document.getElementById('excelDropzone');
  const fileInput = document.getElementById('fileInput');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

// Subir y Procesar Archivo Excel / CSV
async function handleFileUpload(file, customMapping = null) {
  state.currentFile = file;
  const formData = new FormData();
  formData.append('file', file);
  
  const minHealthyMargin = document.getElementById('minHealthyMarginExcel').value || 15;
  formData.append('minHealthyMargin', minHealthyMargin);

  const sheetSelect = document.getElementById('sheetSelect');
  if (sheetSelect && sheetSelect.value) {
    formData.append('sheetName', sheetSelect.value);
  }

  if (customMapping) {
    formData.append('customMapping', JSON.stringify(customMapping));
  }

  showToast(`Procesando archivo: ${file.name}...`);

  try {
    const res = await fetch('/api/v1/import/excel', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error al procesar el archivo');
    }

    state.excelData = data;
    state.products = data.products || [];
    state.expenses = data.expenses || [];
    state.pAndLSummary = data.pAndLSummary || null;
    state.isMultiSection = Boolean(data.isMultiSection);
    state.summary = data.summary;

    // Configurar selector de hojas si hay múltiples
    if (data.sheetNames && data.sheetNames.length > 1) {
      const container = document.getElementById('sheetSelectorContainer');
      const select = document.getElementById('sheetSelect');
      container.style.display = 'flex';
      select.innerHTML = data.sheetNames.map(s => 
        `<option value="${s}" ${s === data.selectedSheet ? 'selected' : ''}>${s}</option>`
      ).join('');

      select.onchange = () => handleFileUpload(state.currentFile);
    }

    if (data.headers && data.mapping && !state.isMultiSection) {
      renderColumnMapping(data.headers, data.mapping);
    } else {
      const mappingSection = document.getElementById('mappingSection');
      if (mappingSection) mappingSection.style.display = 'none';
    }

    updateDashboard();

    if (state.isMultiSection) {
      showToast(`✅ Reporte multisección consolidado: ${state.products.length} servicios y ${state.expenses.length} egresos.`);
    } else {
      showToast(`✅ Se extrajeron ${data.products.length} productos con éxito.`);
    }

    // Cambiar a la pestaña de tablero automáticamente
    document.querySelector('[data-tab="tab-dashboard"]').click();
  } catch (err) {
    console.error(err);
    showToast(`❌ Error: ${err.message}`, 'danger');
  }
}

// Renderizar Cuadrícula de Mapeo de Columnas
function renderColumnMapping(headers, currentMapping) {
  const container = document.getElementById('mappingSection');
  const grid = document.getElementById('mappingGrid');
  container.style.display = 'block';

  const fields = [
    { key: 'name', label: 'Descripción / Producto *' },
    { key: 'costPrice', label: 'Costo Unitario de Compra ($) *' },
    { key: 'salePrice', label: 'Precio de Venta ($) *' },
    { key: 'sku', label: 'Código / SKU' },
    { key: 'category', label: 'Rubro / Categoría' },
    { key: 'stock', label: 'Stock / Cantidad' }
  ];

  grid.innerHTML = fields.map(f => {
    const selectedHeader = currentMapping[f.key] || '';
    const optionsHtml = headers.map(h => 
      `<option value="${h}" ${h === selectedHeader ? 'selected' : ''}>${h}</option>`
    ).join('');

    return `
      <div class="mapping-item">
        <div class="mapping-item-label">
          <span>${f.label}</span>
          ${selectedHeader ? '<strong style="color:var(--primary)">Detectado</strong>' : '<span style="color:var(--text-dim)">Sin asignar</span>'}
        </div>
        <select class="select-field mapping-select" data-field="${f.key}">
          <option value="">-- No mapear --</option>
          ${optionsHtml}
        </select>
      </div>
    `;
  }).join('');

  document.getElementById('btnApplyMapping').onclick = () => {
    const custom = {};
    document.querySelectorAll('.mapping-select').forEach(sel => {
      const key = sel.getAttribute('data-field');
      const val = sel.value;
      if (val) custom[key] = val;
    });
    handleFileUpload(state.currentFile, custom);
  };
}

// Ingesta desde WhatsApp
function initWhatsApp() {
  const btnProcess = document.getElementById('btnProcessWpp');
  const btnLoadSample = document.getElementById('btnLoadWppSample');
  const wppText = document.getElementById('wppInput');

  btnLoadSample.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/v1/import/samples');
      const data = await res.json();
      wppText.value = data.sampleWhatsAppText;
      showToast('Mensaje de ejemplo cargado en el editor.');
    } catch (e) {
      console.error(e);
    }
  });

  btnProcess.addEventListener('click', async () => {
    const text = wppText.value.trim();
    if (!text) {
      showToast('Por favor pega el texto de WhatsApp primero.', 'warning');
      return;
    }

    const defaultIsCost = document.getElementById('wppDefaultIsCost').checked;
    const defaultMarkupPercent = document.getElementById('wppMarkup').value || 35;

    showToast('Interpretando mensaje de WhatsApp...');

    try {
      const res = await fetch('/api/v1/import/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          defaultIsCost,
          defaultMarkupPercent
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar el texto');
      }

      state.isMultiSection = false;
      state.products = data.products;
      state.expenses = [];
      state.pAndLSummary = null;
      state.summary = data.summary;
      updateDashboard();
      showToast(`✅ Se detectaron ${data.products.length} productos del chat.`);

      document.querySelector('[data-tab="tab-dashboard"]').click();
    } catch (err) {
      console.error(err);
      showToast(`❌ Error: ${err.message}`, 'danger');
    }
  });
}

// Cargar Demos Rápidas
function initQuickDemo() {
  // Demo 1: Archivo Multisección Demo (Servicios y Flujo de Egresos)
  const btnReal = document.getElementById('btnRealClientSample');
  if (btnReal) {
    btnReal.addEventListener('click', async () => {
      try {
        showToast('Cargando reporte multisección de ejemplo (Servicios + Egresos)...');
        const response = await fetch('/samples/ejemplo_multiseccion_clinica_demo.csv');
        const blob = await response.blob();
        const file = new File([blob], 'ejemplo_multiseccion_clinica_demo.csv', { type: 'text/csv' });
        handleFileUpload(file);
      } catch (e) {
        console.error(e);
        showToast('No se pudo cargar el archivo demo multisección.', 'danger');
      }
    });
  }

  // Demo 2: Planilla Excel de Distribuidora Mayorista
  const btnQuick = document.getElementById('btnQuickSample');
  if (btnQuick) {
    btnQuick.addEventListener('click', async () => {
      try {
        showToast('Cargando planilla real de Distribuidora Mayorista...');
        const response = await fetch('/samples/ejemplo_lista_precios_pyme.xlsx');
        const blob = await response.blob();
        const file = new File([blob], 'ejemplo_lista_precios_pyme.xlsx', { type: blob.type });
        handleFileUpload(file);
      } catch (e) {
        console.error(e);
        showToast('No se pudo cargar el archivo demo de distribuidora.', 'danger');
      }
    });
  }
}

// Actualizar Dashboard & Métricas de Margen
function updateDashboard() {
  const { summary, products, pAndLSummary, isMultiSection, expenses } = state;
  if (!summary) return;

  // Contador en la pestaña principal
  document.getElementById('tabProductCountBadge').textContent = products.length;

  // KPIs
  document.getElementById('kpiTotalProducts').textContent = products.length;
  document.getElementById('kpiTotalUnits').textContent = `${summary.totalStockUnits} unidades / sesiones`;
  document.getElementById('kpiAvgMargin').textContent = `${summary.averageMarginPercentage.toFixed(1)}%`;
  document.getElementById('kpiAvgMarkup').textContent = `Markup prom: ${summary.averageMarkupPercentage.toFixed(1)}%`;
  document.getElementById('kpiCapitalLocked').textContent = formatMoney(summary.totalCapitalInStock);
  document.getElementById('kpiPotentialRevenue').textContent = `Facturación: ${formatMoney(summary.totalPotentialRevenue)}`;
  document.getElementById('kpiLossCount').textContent = summary.lossCount;
  document.getElementById('kpiCriticalCount').textContent = summary.criticalCount;

  // Contadores de filtros
  document.getElementById('countAll').textContent = products.length;
  document.getElementById('countLoss').textContent = summary.lossCount;
  document.getElementById('countCritical').textContent = summary.criticalCount;
  document.getElementById('countHealthy').textContent = summary.healthyCount;

  // Banner y Selector P&L para reportes multisección
  const pAndLBanner = document.getElementById('pAndLBanner');
  const viewModeSelector = document.getElementById('viewModeSelector');

  if (isMultiSection && pAndLSummary) {
    pAndLBanner.style.display = 'block';
    viewModeSelector.style.display = 'flex';

    document.getElementById('countServicesView').textContent = products.length;
    document.getElementById('countExpensesView').textContent = expenses.length;

    // Valores en el banner de P&L
    document.getElementById('pAndLNetAmount').textContent = formatMoney(pAndLSummary.netOperatingIncome);
    document.getElementById('pAndLNetPct').textContent = `Margen Neto Real: ${pAndLSummary.netMarginPct}%`;
    document.getElementById('pAndLNetAmount').style.color = pAndLSummary.netOperatingIncome >= 0 ? 'var(--primary)' : 'var(--danger)';

    document.getElementById('plNetRevenue').textContent = formatMoney(pAndLSummary.netRevenue);
    document.getElementById('plGrossSub').textContent = `Bruta: ${formatMoney(pAndLSummary.grossRevenue)} | Desc: -${formatMoney(pAndLSummary.discounts)}`;

    document.getElementById('plVarCosts').textContent = `-${formatMoney(pAndLSummary.totalVariableCosts)}`;
    document.getElementById('plVarCostsSub').textContent = `CVT directo: ${formatMoney(pAndLSummary.directVariableCost)} + Op: ${formatMoney(pAndLSummary.operationalVariableCosts)}`;

    document.getElementById('plContribMargin').textContent = formatMoney(pAndLSummary.contributionMargin);
    document.getElementById('plContribMarginPct').textContent = `${pAndLSummary.contributionMarginPct}% s/ facturación neta`;

    document.getElementById('plFixedCosts').textContent = `-${formatMoney(pAndLSummary.totalFixedCosts)}`;
  } else {
    pAndLBanner.style.display = 'none';
    viewModeSelector.style.display = 'none';
    switchViewMode('services');
  }

  // Banner de alerta de pérdida
  const alertLoss = document.getElementById('alertLossContainer');
  const alertText = document.getElementById('alertLossText');
  if (summary.lossCount > 0) {
    alertLoss.style.display = 'flex';
    alertText.innerHTML = `Tienes <strong>${summary.lossCount} producto(s)</strong> con costo mayor al precio de venta. En promedio estás perdiendo dinero en cada venta de estos artículos.`;
  } else {
    alertLoss.style.display = 'none';
  }

  renderCurrentView();
}

// Selector de vista actual (Servicios vs Egresos vs P&L)
function switchViewMode(mode) {
  state.currentViewMode = mode;

  document.querySelectorAll('#viewModeSelector .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === mode);
  });

  const servicesContainer = document.getElementById('servicesViewContainer');
  const expensesContainer = document.getElementById('expensesViewContainer');
  const plContainer = document.getElementById('plViewContainer');
  const toolbar = document.getElementById('servicesToolbar');

  servicesContainer.style.display = mode === 'services' ? 'block' : 'none';
  expensesContainer.style.display = mode === 'expenses' ? 'block' : 'none';
  plContainer.style.display = mode === 'pl' ? 'block' : 'none';
  toolbar.style.display = mode === 'services' ? 'flex' : 'none';

  renderCurrentView();
}

function renderCurrentView() {
  if (state.currentViewMode === 'services') {
    renderProductsTable();
  } else if (state.currentViewMode === 'expenses') {
    renderExpensesTable();
  } else if (state.currentViewMode === 'pl') {
    renderPLTable();
  }
}

// Renderizar Tabla de Productos / Servicios
function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  const { products, activeFilter, searchQuery } = state;

  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-8 text-muted">
          No hay productos cargados aún. Carga un Excel o pega un mensaje de WhatsApp para comenzar.
        </td>
      </tr>
    `;
    return;
  }

  // Filtrado
  const filtered = products.filter(p => {
    if (activeFilter === 'LOSS' && p.status !== 'LOSS') return false;
    if (activeFilter === 'CRITICAL' && p.status !== 'CRITICAL') return false;
    if (activeFilter === 'HEALTHY' && (p.status !== 'HEALTHY' && p.status !== 'EXCELLENT')) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      return matchName || matchSku || matchCat;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-8 text-muted">
          No se encontraron productos o servicios con el filtro seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    let rowClass = '';
    let badgeClass = 'badge-healthy';

    if (p.status === 'LOSS') {
      rowClass = 'row-loss';
      badgeClass = 'badge-loss';
    } else if (p.status === 'CRITICAL') {
      rowClass = 'row-critical';
      badgeClass = 'badge-critical';
    } else if (p.status === 'EXCELLENT') {
      badgeClass = 'badge-excellent';
    }

    const durationDisplay = p.durationHours ? `${p.durationHours} hs` : '-';
    const totalBilled = p.totalRevenue || (p.salePrice * p.stock);

    return `
      <tr class="${rowClass}">
        <td><code class="code-font">${p.sku || '-'}</code></td>
        <td style="font-weight:600; max-width: 250px; overflow: hidden; text-overflow: ellipsis;">
          ${p.name}
          ${Array.isArray(p.providers) && p.providers.length ? `<br><small class="text-muted">Por: ${p.providers.join(', ')}</small>` : ''}
        </td>
        <td><span class="text-muted">${p.category || 'General'}</span></td>
        <td><span class="code-font">${durationDisplay}</span></td>
        <td>
          <input type="number" step="0.01" class="input-number table-inline-input" 
            value="${p.costPrice}" 
            data-id="${p.id}" 
            data-field="costPrice">
        </td>
        <td>
          <input type="number" step="0.01" class="input-number table-inline-input" 
            value="${p.salePrice}" 
            data-id="${p.id}" 
            data-field="salePrice">
        </td>
        <td style="font-weight:700; ${p.grossMargin < 0 ? 'color:var(--danger)' : ''}">
          ${formatMoney(p.grossMargin)}
        </td>
        <td style="font-weight:700; ${p.marginPercentage < 0 ? 'color:var(--danger)' : (p.marginPercentage < 15 ? 'color:var(--warning)' : 'color:var(--primary)')}">
          ${p.marginPercentage.toFixed(1)}%
        </td>
        <td>
          <input type="number" class="input-number table-inline-input" style="width: 70px"
            value="${p.stock}" 
            data-id="${p.id}" 
            data-field="stock">
        </td>
        <td style="font-weight:600;">${formatMoney(totalBilled)}</td>
        <td>
          <span class="badge-status ${badgeClass}">
            ${p.statusLabel}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Escuchar edición en vivo en celdas
  document.querySelectorAll('.table-inline-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const field = e.target.getAttribute('data-field');
      const newVal = parseFloat(e.target.value) || 0;

      const prod = state.products.find(p => p.id === id);
      if (prod) {
        prod[field] = newVal;
        await recalculateProducts();
      }
    });
  });
}

// Renderizar Tabla de Egresos Clasificados
function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  const { expenses } = state;

  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-muted">No hay egresos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => {
    const isFixed = e.isFixed;
    return `
      <tr>
        <td><code class="code-font">${e.id}</code></td>
        <td>${e.date || '-'}</td>
        <td style="font-weight:600;">${e.concept}</td>
        <td>
          <span class="badge-status ${isFixed ? 'badge-critical' : 'badge-healthy'}">
            ${isFixed ? 'COSTO FIJO' : 'COSTO VARIABLE'}
          </span>
        </td>
        <td><span class="text-muted">${e.category}</span></td>
        <td><small class="text-muted">${e.paymentMethod}</small></td>
        <td style="text-align:right; font-weight:700; font-family:var(--font-mono); color:var(--danger);">
          -${formatMoney(e.amount)}
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizar Tabla de Estado de Resultados (P&L Detallado)
function renderPLTable() {
  const tbody = document.getElementById('plTableBody');
  const { pAndLSummary } = state;

  if (!pAndLSummary) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-muted">No hay datos de P&L disponibles.</td></tr>`;
    return;
  }

  const rows = [
    { title: '(+) Facturación Bruta Total', amount: pAndLSummary.grossRevenue, pct: '-', desc: 'Suma total de servicios agendados a precio de lista.', color: '' },
    { title: '(-) Descuentos Comerciales y Bonificaciones', amount: -pAndLSummary.discounts, pct: '-', desc: 'Promociones, convenios y descuentos otorgados.', color: 'text-red' },
    { title: '(=) FACTURACIÓN NETA REAL COBRADA', amount: pAndLSummary.netRevenue, pct: '100.0%', desc: 'Plata real que ingresa al negocio por ventas.', color: 'text-green', isHeader: true },
    { title: '(-) Costos Variables Directos (CVT de prestaciones)', amount: -pAndLSummary.directVariableCost, pct: ((pAndLSummary.directVariableCost / pAndLSummary.netRevenue) * 100).toFixed(1) + '%', desc: 'Costo variable unitario aplicado a cada hora de servicio brindado.', color: 'text-red' },
    { title: '(-) Costos Variables Operativos (Insumos + Alquiler de Máquinas + Honorarios)', amount: -pAndLSummary.operationalVariableCosts, pct: ((pAndLSummary.operationalVariableCosts / pAndLSummary.netRevenue) * 100).toFixed(1) + '%', desc: 'Alquiler de equipos (Soprano, Venus, etc.), horas de prestadores e insumos de tratamiento.', color: 'text-red' },
    { title: '(=) MARGEN DE CONTRIBUCIÓN TOTAL', amount: pAndLSummary.contributionMargin, pct: pAndLSummary.contributionMarginPct + '%', desc: 'Dinero disponible para cubrir los costos fijos y generar ganancia.', color: 'text-green', isHeader: true },
    { title: '(-) Costos Fijos Totales (Alquiler local + Sueldos base + Marketing + ERP)', amount: -pAndLSummary.totalFixedCosts, pct: ((pAndLSummary.totalFixedCosts / pAndLSummary.netRevenue) * 100).toFixed(1) + '%', desc: 'Estructura fija mensual que se paga independientemente del volumen de clientes.', color: 'text-yellow' },
    { title: '(=) RESULTADO OPERATIVO NETO REAL (EBITDA / GANANCIA)', amount: pAndLSummary.netOperatingIncome, pct: pAndLSummary.netMarginPct + '%', desc: 'Lo que realmente le queda al dueño al final del mes. Revela si facturar más significó ganar más.', color: pAndLSummary.netOperatingIncome >= 0 ? 'text-green' : 'text-red', isHighlight: true }
  ];

  tbody.innerHTML = rows.map(r => {
    return `
      <tr style="${r.isHeader ? 'background:rgba(255,255,255,0.03); font-weight:700;' : ''} ${r.isHighlight ? 'background:rgba(16,185,129,0.08); font-weight:800;' : ''}">
        <td><strong>${r.title}</strong></td>
        <td style="text-align:right; font-family:var(--font-mono); font-size:1rem;" class="${r.color}">${formatMoney(r.amount)}</td>
        <td style="text-align:right; font-family:var(--font-mono);">${r.pct}</td>
        <td><small class="text-muted">${r.desc}</small></td>
      </tr>
    `;
  }).join('');
}

// Recalcular productos en el backend al modificar valores
async function recalculateProducts() {
  try {
    const res = await fetch('/api/v1/products/normalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: state.products
      })
    });
    const data = await res.json();
    if (data.success) {
      state.products = data.products;
      state.summary = data.summary;
      updateDashboard();
    }
  } catch (err) {
    console.error('Error recalculando:', err);
  }
}

// Inicialización de Filtros y Búsqueda
function initFiltersAndActions() {
  // Selector de sub-vistas (Servicios vs Egresos vs P&L)
  document.querySelectorAll('#viewModeSelector .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view');
      switchViewMode(mode);
    });
  });

  const pills = document.querySelectorAll('#servicesToolbar .pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.getAttribute('data-filter');
      renderProductsTable();
    });
  });

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderProductsTable();
  });

  // Exportar Excel Limpio (Con hojas múltiples si es multisección)
  document.getElementById('btnExportExcel').addEventListener('click', async () => {
    if (!state.products || state.products.length === 0) {
      showToast('No hay productos para exportar.', 'warning');
      return;
    }

    try {
      showToast('Generando Excel normalizado con hojas de Servicios, Egresos y P&L...');
      const res = await fetch('/api/v1/products/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products,
          expenses: state.expenses,
          pAndLSummary: state.pAndLSummary
        })
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogo_margen_gestion_completo.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('✅ Excel descargado correctamente con todas las hojas.');
    } catch (e) {
      console.error(e);
      showToast('Error al exportar Excel.', 'danger');
    }
  });

  // Copiar JSON compatible con Margen App
  document.getElementById('btnCopyJson').addEventListener('click', async () => {
    if (!state.products || state.products.length === 0) {
      showToast('No hay productos cargados.', 'warning');
      return;
    }

    try {
      let endpoint = '/api/v1/products/format-margen';
      let reqBody = { products: state.products, metadata: { organization: 'Mi PyME', currency: 'ARS' } };

      if (state.isMultiSection) {
        endpoint = '/api/v1/products/format-margen-repo';
        reqBody = {
          products: state.products,
          expenses: state.expenses,
          pAndLSummary: state.pAndLSummary
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });

      const data = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      showToast('✅ Payload JSON formateado para Margen copiado al portapapeles!');
    } catch (e) {
      console.error(e);
      showToast('Error al copiar JSON.', 'danger');
    }
  });

  // Sincronización Directa con Margen App
  document.getElementById('btnTriggerSync').addEventListener('click', async () => {
    if (!state.products || state.products.length === 0) {
      showToast('No hay productos para sincronizar.', 'warning');
      return;
    }

    const targetApiUrl = document.getElementById('syncUrl').value.trim();
    const apiKey = document.getElementById('syncKey').value.trim();
    const organization = document.getElementById('syncOrg').value.trim();
    const resultBox = document.getElementById('syncResultBox');

    showToast('Enviando datos a Margen App...');
    resultBox.style.display = 'block';
    resultBox.textContent = 'Enviando petición...';

    try {
      const res = await fetch('/api/v1/sync/margen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products,
          expenses: state.expenses,
          pAndLSummary: state.pAndLSummary,
          targetApiUrl,
          apiKey,
          organization
        })
      });

      const data = await res.json();
      resultBox.textContent = JSON.stringify(data, null, 2);
      if (data.success) {
        showToast('✅ ' + data.message);
      } else {
        showToast('❌ ' + data.error, 'danger');
      }
    } catch (err) {
      resultBox.textContent = 'Error: ' + err.message;
      showToast('Error en la sincronización: ' + err.message, 'danger');
    }
  });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDropzone();
  initWhatsApp();
  initQuickDemo();
  initFiltersAndActions();
});

/**
 * Margen DataBridge - Frontend Controller
 */

// Estado global de la aplicación
const state = {
  currentFile: null,
  excelData: null,
  products: [],
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

// Subir y Procesar Archivo Excel
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
    state.products = data.products;
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

    renderColumnMapping(data.headers, data.mapping);
    updateDashboard();
    showToast(`✅ Se extrajeron ${data.products.length} productos con éxito.`);

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

      state.products = data.products;
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

// Cargar Caso Real Demo (Botón rápido superior)
async function initQuickDemo() {
  const btn = document.getElementById('btnQuickSample');
  btn.addEventListener('click', async () => {
    try {
      showToast('Cargando planilla real de ejemplo...');
      const response = await fetch('/samples/ejemplo_lista_precios_pyme.xlsx');
      const blob = await response.blob();
      const file = new File([blob], 'ejemplo_lista_precios_pyme.xlsx', { type: blob.type });
      handleFileUpload(file);
    } catch (e) {
      console.error(e);
      showToast('No se pudo cargar el archivo demo.', 'danger');
    }
  });
}

// Actualizar Dashboard & Métricas de Margen
function updateDashboard() {
  const { summary, products } = state;
  if (!summary) return;

  // Contador en la pestaña
  document.getElementById('tabProductCountBadge').textContent = products.length;

  // KPIs
  document.getElementById('kpiTotalProducts').textContent = summary.totalProducts;
  document.getElementById('kpiTotalUnits').textContent = `${summary.totalStockUnits} unidades en stock`;
  document.getElementById('kpiAvgMargin').textContent = `${summary.averageMarginPercentage.toFixed(1)}%`;
  document.getElementById('kpiAvgMarkup').textContent = `Markup prom: ${summary.averageMarkupPercentage.toFixed(1)}%`;
  document.getElementById('kpiCapitalLocked').textContent = formatMoney(summary.totalCapitalInStock);
  document.getElementById('kpiPotentialRevenue').textContent = `Venta pot: ${formatMoney(summary.totalPotentialRevenue)}`;
  document.getElementById('kpiLossCount').textContent = summary.lossCount;
  document.getElementById('kpiCriticalCount').textContent = summary.criticalCount;

  // Contadores de filtros
  document.getElementById('countAll').textContent = products.length;
  document.getElementById('countLoss').textContent = summary.lossCount;
  document.getElementById('countCritical').textContent = summary.criticalCount;
  document.getElementById('countHealthy').textContent = summary.healthyCount;

  // Banner de alerta de pérdida
  const alertLoss = document.getElementById('alertLossContainer');
  const alertText = document.getElementById('alertLossText');
  if (summary.lossCount > 0) {
    alertLoss.style.display = 'flex';
    alertText.innerHTML = `Tienes <strong>${summary.lossCount} producto(s)</strong> con costo mayor al precio de venta. En promedio estás perdiendo dinero en cada venta de estos artículos.`;
  } else {
    alertLoss.style.display = 'none';
  }

  renderProductsTable();
}

// Renderizar Tabla de Productos
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
    // Filtro por estado
    if (activeFilter === 'LOSS' && p.status !== 'LOSS') return false;
    if (activeFilter === 'CRITICAL' && p.status !== 'CRITICAL') return false;
    if (activeFilter === 'HEALTHY' && (p.status !== 'HEALTHY' && p.status !== 'EXCELLENT')) return false;

    // Búsqueda textual
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
          No se encontraron productos con el filtro o búsqueda seleccionada.
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

    return `
      <tr class="${rowClass}">
        <td><code class="code-font">${p.sku || '-'}</code></td>
        <td style="font-weight:600; max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${p.name}</td>
        <td><span class="text-muted">${p.category || 'General'}</span></td>
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
        <td>${p.markupPercentage.toFixed(1)}%</td>
        <td>
          <input type="number" class="input-number table-inline-input" style="width: 70px"
            value="${p.stock}" 
            data-id="${p.id}" 
            data-field="stock">
        </td>
        <td>${formatMoney(p.stockValueCost)}</td>
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
        // Recalcular métricas
        await recalculateProducts();
      }
    });
  });
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
  const pills = document.querySelectorAll('.pill-btn');
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

  // Exportar Excel Limpio
  document.getElementById('btnExportExcel').addEventListener('click', async () => {
    if (!state.products || state.products.length === 0) {
      showToast('No hay productos para exportar.', 'warning');
      return;
    }

    try {
      showToast('Generando Excel limpio de Margen...');
      const res = await fetch('/api/v1/products/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: state.products })
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogo_margen_gestion.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('✅ Excel descargado correctamente.');
    } catch (e) {
      console.error(e);
      showToast('Error al exportar Excel.', 'danger');
    }
  });

  // Copiar JSON para la app de Margen
  document.getElementById('btnCopyJson').addEventListener('click', async () => {
    if (!state.products || state.products.length === 0) {
      showToast('No hay productos cargados.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/v1/products/format-margen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products,
          metadata: { organization: 'Mi PyME', currency: 'ARS' }
        })
      });

      const data = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(data.data, null, 2));
      showToast('✅ Payload JSON copiado al portapapeles!');
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

    showToast('Enviando productos a Margen App...');
    resultBox.style.display = 'block';
    resultBox.textContent = 'Enviando petición...';

    try {
      const res = await fetch('/api/v1/sync/margen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products,
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

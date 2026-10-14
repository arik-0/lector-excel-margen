const { parseNumericValue } = require('../utils/numberUtils');
const { calculateProductMetrics, calculateSummaryMetrics } = require('./marginCalculator');

/**
 * Patrones de clasificación de egresos inspirados en la lógica contable de Margen (tumargen):
 * Distingue costos fijos, variables, alquileres de equipos médicos/estéticos, honorarios e insumos.
 */
const EQUIPMENT_RENT_PATTERN = /soprano|picosegundo|pico\s*segundo|venus|vela\s*shape|velashape|\bvela\b|rejuve|luz pulsada|spectra|\balma\b|laser|dermapen|hifu/i;
const LOCAL_RENT_PATTERN = /alquiler\s+agos|alquiler.*local|alquiler.*salon|alquiler.*consultorio/i;
const HOURLY_LABOR_PATTERN = /hs?\.?\s*(?:jaz|juli|rosi|more)|%\s*(?:audisio|juli|nutri)|honorarios/i;
const SUPPLIES_PATTERN = /gel\s+neutro|carb[oó]n|gasas|pinceles|binchas|crema|rollos|insumos|agujas|desinfectante|ampollas/i;
const MARKETING_PATTERN = /publicidad|marketing|meta\s*ads|google\s*ads|redes/i;
const ADMIN_SOFTWARE_PATTERN = /pago\s*sistema|software|erp|gestion/i;
const FIXED_SALARY_PATTERN = /sueldo|adelanto\s*sueldo|pago\s+(?:a\s+)?sofi|pago\s+(?:a\s+)?cele/i;
const LOCAL_EXPENSES_PATTERN = /yerba|galleta|caramelos|papel\s*higienico|cinta|limpieza|librer[ií]a/i;

function classifyExpenseConcept(concept, amount) {
  const text = String(concept || '').trim();

  if (EQUIPMENT_RENT_PATTERN.test(text)) {
    return {
      type: 'costo_variable',
      subType: 'alquiler_maquinas',
      category: 'Alquiler de Equipos',
      label: 'Alquiler Variable de Equipo',
      isFixed: false
    };
  }

  if (LOCAL_RENT_PATTERN.test(text)) {
    return {
      type: 'costo_fijo',
      subType: 'alquiler_local',
      category: 'Alquiler',
      label: 'Alquiler del Local / Inmueble',
      isFixed: true
    };
  }

  if (HOURLY_LABOR_PATTERN.test(text)) {
    return {
      type: 'costo_variable',
      subType: 'honorarios_prestadores',
      category: 'Mano de Obra Variable',
      label: 'Horas y Porcentajes de Prestadores',
      isFixed: false
    };
  }

  if (SUPPLIES_PATTERN.test(text)) {
    return {
      type: 'costo_variable',
      subType: 'insumos_tratamiento',
      category: 'Insumos',
      label: 'Insumos de Tratamientos',
      isFixed: false
    };
  }

  if (MARKETING_PATTERN.test(text)) {
    return {
      type: 'costo_fijo',
      subType: 'marketing',
      category: 'Marketing',
      label: 'Publicidad y Marketing',
      isFixed: true
    };
  }

  if (ADMIN_SOFTWARE_PATTERN.test(text)) {
    return {
      type: 'costo_fijo',
      subType: 'software',
      category: 'Administración',
      label: 'Software y Gestión ERP',
      isFixed: true
    };
  }

  if (FIXED_SALARY_PATTERN.test(text)) {
    return {
      type: 'costo_fijo',
      subType: 'sueldos_fijos',
      category: 'Sueldos',
      label: 'Sueldos Base del Personal',
      isFixed: true
    };
  }

  if (LOCAL_EXPENSES_PATTERN.test(text)) {
    return {
      type: 'costo_fijo',
      subType: 'gastos_generales',
      category: 'Servicios y Mantenimiento',
      label: 'Gastos Menores de Local',
      isFixed: true
    };
  }

  // Si no coincide con ninguno, por defecto costo general
  return {
    type: 'costo_variable',
    subType: 'otros',
    category: 'Otros Egresos',
    label: 'Otros Gastos Operativos',
    isFixed: false
  };
}

/**
 * Detecta si el contenido de texto (o array de líneas/filas) contiene múltiples
 * bloques estructurados (típico de AgendaPro: tabla de ventas arriba y tabla de egresos abajo).
 */
function isMultiSectionFile(rawTextOrRows) {
  const text = Array.isArray(rawTextOrRows)
    ? rawTextOrRows.map(r => Array.isArray(r) ? r.join(',') : String(r)).join('\n')
    : String(rawTextOrRows || '');

  const hasSalesHeader = /ID Venta|Nombre item|Precio unitario/i.test(text);
  const hasCashflowHeader = /Resumen Flujo de Egresos|Flujo del periodo/i.test(text);

  return hasSalesHeader && hasCashflowHeader;
}

/**
 * Parser de líneas CSV que respeta celdas vacías (,,) y textos entrecomillados con comas ("bozo, menton")
 */
function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parsea un archivo multisección (Ventas + Egresos) y devuelve tanto
 * los servicios consolidados como el desglose financiero completo.
 */
function parseMultiSectionReport(rawText, options = {}) {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim() !== '');

  let currentSection = null;
  const salesRawRows = [];
  const expensesRawRows = [];

  let salesHeader = null;
  let expensesHeader = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar inicio de sección de ventas
    if (/ID Venta.*Nombre item/i.test(line)) {
      currentSection = 'SALES';
      salesHeader = splitCsvLine(line);
      continue;
    }

    // Detectar inicio de sección de egresos
    if (/Resumen Flujo de Egresos/i.test(line)) {
      currentSection = 'EXPENSES_PREAMBLE';
      continue;
    }

    if (currentSection === 'EXPENSES_PREAMBLE') {
      if (/Fecha.*Flujo del periodo/i.test(line)) {
        currentSection = 'EXPENSES';
        expensesHeader = splitCsvLine(line);
      }
      continue;
    }

    if (currentSection === 'SALES') {
      salesRawRows.push(line);
    } else if (currentSection === 'EXPENSES') {
      expensesRawRows.push(line);
    }
  }

  // 1. PROCESAR TRANSACCIONES DE VENTAS / SERVICIOS
  const salesTransactions = [];
  const servicesMap = new Map();

  let totalRevenueGross = 0;
  let totalDiscounts = 0;
  let totalRevenueNet = 0;
  let totalDirectCVT = 0;

  // Índices en el header de ventas
  const idxId = salesHeader.findIndex(h => /ID Venta/i.test(h));
  const idxDate = salesHeader.findIndex(h => /Fecha venta/i.test(h));
  const idxCustomer = salesHeader.findIndex(h => /Cliente/i.test(h));
  const idxCat = salesHeader.findIndex(h => /Categor/i.test(h));
  const idxName = salesHeader.findIndex(h => /Nombre item/i.test(h));
  const idxHours = salesHeader.findIndex(h => /HORAS/i.test(h));
  const idxCVU = salesHeader.findIndex(h => /CVU/i.test(h));
  const idxCVT = salesHeader.findIndex(h => /^CVT$/i.test(h));
  const idxQty = salesHeader.findIndex(h => /Cantidad/i.test(h));
  const idxPrice = salesHeader.findIndex(h => /Precio unitario/i.test(h));
  const idxDiscount = salesHeader.findIndex(h => /Descuento/i.test(h));
  const idxTotal = salesHeader.findIndex(h => /^Total$/i.test(h));
  const idxProvider = salesHeader.findIndex(h => /Prestador/i.test(h));

  salesRawRows.forEach((rowLine, rIdx) => {
    const cleanCols = splitCsvLine(rowLine);

    const saleId = cleanCols[idxId] || `#${rIdx + 1}`;
    const serviceName = cleanCols[idxName] || '';
    if (!serviceName) return;

    const category = cleanCols[idxCat] || 'Servicio General';
    const customer = cleanCols[idxCustomer] || 'Consumidor';
    const provider = cleanCols[idxProvider] || 'General';
    const hours = parseNumericValue(cleanCols[idxHours]) || 0;
    const cvu = parseNumericValue(cleanCols[idxCVU]) || 0;
    const cvt = parseNumericValue(cleanCols[idxCVT]) || (cvu * hours);
    const qty = Math.max(1, Math.floor(parseNumericValue(cleanCols[idxQty])));
    const unitPrice = parseNumericValue(cleanCols[idxPrice]);
    const discount = parseNumericValue(cleanCols[idxDiscount]);
    const total = parseNumericValue(cleanCols[idxTotal]) || (unitPrice * qty - discount);

    totalRevenueGross += (unitPrice * qty);
    totalDiscounts += discount;
    totalRevenueNet += total;
    totalDirectCVT += cvt;

    const tx = {
      id: saleId,
      date: cleanCols[idxDate] || '',
      serviceName,
      category,
      customer,
      provider,
      hours,
      costUnit: Number((cvt / qty).toFixed(2)),
      totalCost: cvt,
      unitPrice,
      discount,
      totalNet: total,
      qty
    };
    salesTransactions.push(tx);

    // Consolidación por catálogo de servicio
    const key = serviceName.trim().toLowerCase();
    if (!servicesMap.has(key)) {
      servicesMap.set(key, {
        id: `srv-${servicesMap.size + 1}`,
        sku: `SRV-${String(servicesMap.size + 1).padStart(3, '0')}`,
        name: serviceName.trim(),
        category,
        totalSoldQty: 0,
        totalRevenue: 0,
        totalCost: 0,
        hoursList: [],
        providers: new Set(),
        transactionsCount: 0
      });
    }

    const srv = servicesMap.get(key);
    srv.totalSoldQty += qty;
    srv.totalRevenue += total;
    srv.totalCost += cvt;
    if (hours > 0) srv.hoursList.push(hours);
    if (provider) srv.providers.add(provider);
    srv.transactionsCount++;
  });

  // Generar productos consolidados para la app y el catálogo
  const consolidatedProducts = Array.from(servicesMap.values()).map(s => {
    const avgPrice = s.totalSoldQty > 0 ? (s.totalRevenue / s.totalSoldQty) : 0;
    const avgCost = s.totalSoldQty > 0 ? (s.totalCost / s.totalSoldQty) : 0;
    const avgDuration = s.hoursList.length > 0 
      ? (s.hoursList.reduce((a, b) => a + b, 0) / s.hoursList.length) 
      : null;

    const metrics = calculateProductMetrics({
      id: s.id,
      sku: s.sku,
      name: s.name,
      category: s.category,
      costPrice: Number(avgCost.toFixed(2)),
      salePrice: Number(avgPrice.toFixed(2)),
      stock: s.totalSoldQty, // unidades vendidas en el período
      source: 'AGENDA_PRO_SALES',
      offerType: 'servicio',
      durationHours: avgDuration ? Number(avgDuration.toFixed(2)) : null,
      providers: Array.from(s.providers),
      transactionsCount: s.transactionsCount,
      totalRevenue: Number(s.totalRevenue.toFixed(2)),
      totalCost: Number(s.totalCost.toFixed(2))
    }, { minHealthyMargin: options.minHealthyMargin || 15 });

    return metrics;
  });

  // 2. PROCESAR FLUJO DE EGRESOS
  const expenses = [];
  let totalExpenses = 0;
  let totalFixedCosts = 0;
  let totalVariableCostsFromExpenses = 0;

  const idxExpDate = expensesHeader.findIndex(h => /Fecha/i.test(h));
  const idxExpMethod = expensesHeader.findIndex(h => /Medio de Pago/i.test(h));
  const idxExpConcept = expensesHeader.findIndex(h => /Nro Comprobante|Concepto/i.test(h));
  const idxExpAmount = expensesHeader.findIndex(h => /Flujo del periodo/i.test(h));

  expensesRawRows.forEach((rowLine, eIdx) => {
    const cols = splitCsvLine(rowLine);
    if (cols.length < 3) return;

    const date = cols[idxExpDate] ? cols[idxExpDate].trim() : '';
    const method = cols[idxExpMethod] ? cols[idxExpMethod].trim() : 'Efectivo';
    const concept = cols[idxExpConcept] ? cols[idxExpConcept].trim() : `Egreso #${eIdx + 1}`;
    const amount = parseNumericValue(cols[idxExpAmount]);

    if (!concept && amount === 0) return;

    const classification = classifyExpenseConcept(concept, amount);
    totalExpenses += amount;

    if (classification.isFixed) {
      totalFixedCosts += amount;
    } else {
      totalVariableCostsFromExpenses += amount;
    }

    expenses.push({
      id: `egr-${eIdx + 1}`,
      date,
      concept,
      amount,
      paymentMethod: method,
      ...classification
    });
  });

  // 3. ESTADO DE RESULTADOS DE GESTIÓN (P&L MARGEN)
  const totalVariableCostsAll = totalDirectCVT + totalVariableCostsFromExpenses;
  const contributionMargin = totalRevenueNet - totalVariableCostsAll;
  const contributionMarginPct = totalRevenueNet > 0 ? (contributionMargin / totalRevenueNet) * 100 : 0;
  const netOperatingIncome = contributionMargin - totalFixedCosts; // EBITDA Real
  const netMarginPct = totalRevenueNet > 0 ? (netOperatingIncome / totalRevenueNet) * 100 : 0;

  const pAndLSummary = {
    grossRevenue: Number(totalRevenueGross.toFixed(2)),
    discounts: Number(totalDiscounts.toFixed(2)),
    netRevenue: Number(totalRevenueNet.toFixed(2)),
    directVariableCost: Number(totalDirectCVT.toFixed(2)),
    operationalVariableCosts: Number(totalVariableCostsFromExpenses.toFixed(2)),
    totalVariableCosts: Number(totalVariableCostsAll.toFixed(2)),
    contributionMargin: Number(contributionMargin.toFixed(2)),
    contributionMarginPct: Number(contributionMarginPct.toFixed(2)),
    totalFixedCosts: Number(totalFixedCosts.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netOperatingIncome: Number(netOperatingIncome.toFixed(2)),
    netMarginPct: Number(netMarginPct.toFixed(2)),
    isProfitable: netOperatingIncome > 0
  };

  const summary = calculateSummaryMetrics(consolidatedProducts);

  return {
    isMultiSection: true,
    fileType: 'REPORTE_GESTION_VENTAS_EGRESOS',
    organization: 'Centro de Servicios / Clínica Demo',
    salesPeriod: 'Agosto 2026',
    salesTransactionsCount: salesTransactions.length,
    expensesCount: expenses.length,
    servicesCount: consolidatedProducts.length,
    products: consolidatedProducts,
    expenses,
    pAndLSummary,
    summary
  };
}

/**
 * Convierte el resultado del reporte multisección al formato estricto
 * requerido por la API de Margen (/api/import o supabase apply_import_set)
 */
function formatForMargenImportRepo(multiSectionResult) {
  const { products, expenses, pAndLSummary } = multiSectionResult;

  const importItems = [];

  // 1. Agregar servicios / ventas
  products.forEach(p => {
    importItems.push({
      categoria_sugerida: 'producto',
      tipo_oferta: 'servicio',
      nombre: p.name,
      monto: p.salePrice,
      costo_unitario: p.costPrice,
      cantidad: p.stock, // total vendido
      duracion_horas: p.durationHours || null,
      categoria: p.category,
      sku: p.sku,
      prestadores: p.providers || []
    });
  });

  // 2. Agregar egresos clasificados
  expenses.forEach(e => {
    importItems.push({
      categoria_sugerida: e.type, // 'costo_fijo' | 'costo_variable'
      tipo_oferta: 'gasto',
      nombre: e.concept,
      monto: e.amount,
      cf_categoria: e.category,
      is_fixed: e.isFixed,
      sub_type: e.subType
    });
  });

  return {
    ok: true,
    data: {
      tipo_documento: 'mixto',
      organization: 'Centro de Servicios / Clínica Demo',
      periodo: '2026-08',
      totales: pAndLSummary,
      items: importItems
    }
  };
}

module.exports = {
  isMultiSectionFile,
  parseMultiSectionReport,
  classifyExpenseConcept,
  formatForMargenImportRepo
};

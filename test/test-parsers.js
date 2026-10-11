const fs = require('fs');
const path = require('path');
const { parseExcelBuffer } = require('../src/services/excelParser');
const { parseWhatsAppText } = require('../src/services/whatsappParser');
const { calculateSummaryMetrics } = require('../src/services/marginCalculator');

console.log('🧪 Iniciando tests automatizados de Margen DataBridge...');

// TEST 1: Excel Parser
try {
  const excelPath = path.join(__dirname, '..', 'public', 'samples', 'ejemplo_lista_precios_pyme.xlsx');
  const buffer = fs.readFileSync(excelPath);
  const excelResult = parseExcelBuffer(buffer);

  console.log('\n--- 1. TEST EXCEL PARSER ---');
  console.log('Hoja detectada:', excelResult.selectedSheet);
  console.log('Fila de encabezado detectada:', excelResult.headerRowIndex);
  console.log('Columnas mapeadas:', excelResult.mapping);
  console.log('Total productos encontrados:', excelResult.products.length);
  console.log('Margen promedio:', excelResult.summary.averageMarginPercentage + '%');
  console.log('Productos a pérdida (LOSS):', excelResult.summary.lossCount);
  console.log('Productos críticos (CRITICAL):', excelResult.summary.criticalCount);

  if (excelResult.products.length < 5) {
    throw new Error('Fallo: Se esperaban al menos 5 productos');
  }
  if (excelResult.summary.lossCount < 1) {
    throw new Error('Fallo: Debería detectar al menos 1 producto a pérdida (Aceite Natura)');
  }
  console.log('✅ TEST EXCEL: PASÓ con éxito.');
} catch (e) {
  console.error('❌ Error en Test Excel:', e);
  process.exit(1);
}

// TEST 2: WhatsApp Parser
try {
  console.log('\n--- 2. TEST WHATSAPP PARSER ---');
  const sampleWpp = `
[10/10/24, 15:30] Distribuidora: Lista de precios:
- Coca Cola 1.5L x 24 un: $ 1.450 (Costo: $ 980)
- Yerba Playadito 500g: $ 2.100 (Costo: $ 1.650) stock 40
- Aceite Natura Girasol 900ml: $ 1.750 (Costo: $ 1.820)
- Galletitas Chocolinas 250g $ 1.300 costo $ 900
`;

  const wppResult = parseWhatsAppText(sampleWpp);
  console.log('Productos detectados de WhatsApp:', wppResult.productsDetected);
  console.log('Mapeo de productos:', wppResult.products.map(p => ({
    nombre: p.name,
    costo: p.costPrice,
    precio: p.salePrice,
    margen: p.grossMargin,
    pct: p.marginPercentage + '%',
    estado: p.status
  })));

  if (wppResult.productsDetected !== 4) {
    throw new Error(`Fallo: Se esperaban 4 productos en WhatsApp, se obtuvieron ${wppResult.productsDetected}`);
  }
  console.log('✅ TEST WHATSAPP: PASÓ con éxito.');
} catch (e) {
  console.error('❌ Error en Test WhatsApp:', e);
  process.exit(1);
}

console.log('\n🎉 ¡TODOS LOS TESTS DE PARSEO Y FINANZAS PASARON EXITOSAMENTE!');

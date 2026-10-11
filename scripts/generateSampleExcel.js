const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, '..', 'public', 'samples');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simulamos una típica lista de precios de una distribuidora con encabezado decorativo arriba
const data = [
  ['DISTRIBUIDORA MAYORISTA CENTRAL S.A.'],
  ['Lista de Precios y Costos de Reposición - Octubre 2024'],
  [''], // Fila vacía
  // Fila de encabezados reales en la fila 4
  ['COD_ART', 'DESCRIPCION DEL PRODUCTO', 'RUBRO', 'COSTO_COMPRA', 'PRECIO_VENTA_PUB', 'STOCK_UNID'],
  ['BEB-01', 'Coca Cola 1.5L descartable', 'Bebidas', 980, 1450, 60],
  ['BEB-02', 'Cerveza Quilmes Clásica 1L', 'Bebidas', 1350, 1900, 36],
  ['BEB-03', 'Fernet Branca 750ml', 'Bebidas', 6800, 9200, 12],
  ['ALM-01', 'Yerba Mate Playadito 500g', 'Almacén', 1650, 2100, 45],
  ['ALM-02', 'Aceite Natura Girasol 900ml', 'Almacén', 1820, 1750, 25], // ¡A PÉRDIDA! Caso clave para Margen
  ['ALM-03', 'Harina 000 Cañuelas 1kg', 'Almacén', 810, 890, 80],    // Margen crítico (9.8%)
  ['ALM-04', 'Café La Virginia Molido 500g', 'Almacén', 2500, 3800, 20],
  ['ALM-05', 'Galletitas Chocolinas 250g', 'Almacén', 920, 1300, 50],
  ['LIM-01', 'Detergente Magistral 500ml', 'Limpieza', 1250, 1850, 30],
  ['LIM-02', 'Jabón Líquido Ariel 3L', 'Limpieza', 5100, 7500, 15],
  ['LIM-03', 'Lavandina Ayudín 1L', 'Limpieza', 890, 950, 40]       // Margen crítico (6.3%)
];

const worksheet = XLSX.utils.aoa_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Precios y Costos');

const filePath = path.join(outputDir, 'ejemplo_lista_precios_pyme.xlsx');
XLSX.writeFile(workbook, filePath);

console.log('✅ Archivo de prueba generado en:', filePath);

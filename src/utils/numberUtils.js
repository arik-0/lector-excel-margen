/**
 * Utilidades para normalización y parseo de valores numéricos y monetarios
 */
function parseNumericValue(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Quitar símbolos de moneda, espacios
  str = str.replace(/[$€USDARS\s]/gi, '');

  // Detectar formato: si tiene punto y coma, determinar cuál es decimal
  if (str.includes('.') && str.includes(',')) {
    // Caso 1.250,50 (formato AR/ES)
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Caso 1,250.50 (formato US)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Si solo tiene coma, típicamente es decimal: 1250,50 -> 1250.50
    if (/^\d{1,3},\d{3}$/.test(str)) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    // Si tiene múltiples puntos: 1.250.000 -> miles
    if (str.split('.').length > 2) {
      str = str.replace(/\./g, '');
    } else if (/^\d{1,3}\.\d{3}$/.test(str)) {
      // Caso típico latinoamericano: 1.450 o 2.100 -> miles
      str = str.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

module.exports = {
  parseNumericValue
};

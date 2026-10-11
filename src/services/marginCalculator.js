/**
 * Servicio de Cálculo y Análisis Financiero de Margen
 * Inspirado en la metodología de gestión de Margen (tumargen):
 * "Saber cuánto te sale de verdad cada cosa que vendés, qué te deja plata y qué te la está sacando"
 */

function calculateProductMetrics(item, options = {}) {
  const minHealthyMargin = options.minHealthyMargin || 15; // 15% umbral crítico por defecto
  
  const cost = Number(item.costPrice) || 0;
  const price = Number(item.salePrice) || 0;
  const stock = Number(item.stock) || 0;

  let grossMargin = 0;
  let marginPercentage = 0;
  let markupPercentage = 0;
  let status = 'UNKNOWN';
  let statusLabel = 'Datos incompletos';
  let alerts = [];

  if (price > 0 && cost > 0) {
    grossMargin = price - cost;
    marginPercentage = (grossMargin / price) * 100;
    markupPercentage = (grossMargin / cost) * 100;

    if (grossMargin < 0) {
      status = 'LOSS';
      statusLabel = 'A Pérdida';
      alerts.push(`Estás perdiendo $${Math.abs(grossMargin).toFixed(2)} por unidad vendida.`);
    } else if (marginPercentage < minHealthyMargin) {
      status = 'CRITICAL';
      statusLabel = 'Margen Crítico';
      alerts.push(`Margen de solo ${marginPercentage.toFixed(1)}%, inferior al objetivo del ${minHealthyMargin}%.`);
    } else if (marginPercentage >= 40) {
      status = 'EXCELLENT';
      statusLabel = 'Alto Rendimiento';
    } else {
      status = 'HEALTHY';
      statusLabel = 'Saludable';
    }
  } else if (price > 0 && cost === 0) {
    status = 'MISSING_COST';
    statusLabel = 'Sin Costo';
    alerts.push('Falta definir el costo unitario para calcular el margen real.');
  } else if (cost > 0 && price === 0) {
    status = 'MISSING_PRICE';
    statusLabel = 'Sin Precio';
    alerts.push('Producto sin precio de venta definido.');
  }

  const stockValueCost = stock > 0 && cost > 0 ? stock * cost : 0;
  const stockValueSale = stock > 0 && price > 0 ? stock * price : 0;
  const stockGrossMarginPotential = stockValueSale - stockValueCost;

  return {
    ...item,
    costPrice: Number(cost.toFixed(2)),
    salePrice: Number(price.toFixed(2)),
    stock: stock,
    grossMargin: Number(grossMargin.toFixed(2)),
    marginPercentage: Number(marginPercentage.toFixed(2)),
    markupPercentage: Number(markupPercentage.toFixed(2)),
    stockValueCost: Number(stockValueCost.toFixed(2)),
    stockValueSale: Number(stockValueSale.toFixed(2)),
    stockGrossMarginPotential: Number(stockGrossMarginPotential.toFixed(2)),
    status,
    statusLabel,
    alerts
  };
}

function calculateSummaryMetrics(products) {
  if (!products || products.length === 0) {
    return {
      totalProducts: 0,
      totalStockUnits: 0,
      totalCapitalInStock: 0,
      totalPotentialRevenue: 0,
      totalPotentialMargin: 0,
      averageMarginPercentage: 0,
      averageMarkupPercentage: 0,
      lossCount: 0,
      criticalCount: 0,
      healthyCount: 0,
      missingCostCount: 0,
      topProfitable: [],
      lossMakingProducts: []
    };
  }

  let totalStockUnits = 0;
  let totalCapitalInStock = 0;
  let totalPotentialRevenue = 0;
  let sumMarginPct = 0;
  let sumMarkupPct = 0;
  let validMarginCount = 0;

  let lossCount = 0;
  let criticalCount = 0;
  let healthyCount = 0;
  let missingCostCount = 0;

  products.forEach(p => {
    totalStockUnits += (p.stock || 0);
    totalCapitalInStock += (p.stockValueCost || 0);
    totalPotentialRevenue += (p.stockValueSale || 0);

    if (p.costPrice > 0 && p.salePrice > 0) {
      sumMarginPct += p.marginPercentage;
      sumMarkupPct += p.markupPercentage;
      validMarginCount++;
    }

    if (p.status === 'LOSS') lossCount++;
    else if (p.status === 'CRITICAL') criticalCount++;
    else if (p.status === 'HEALTHY' || p.status === 'EXCELLENT') healthyCount++;
    else if (p.status === 'MISSING_COST') missingCostCount++;
  });

  const averageMarginPercentage = validMarginCount > 0 ? (sumMarginPct / validMarginCount) : 0;
  const averageMarkupPercentage = validMarginCount > 0 ? (sumMarkupPct / validMarginCount) : 0;
  const totalPotentialMargin = totalPotentialRevenue - totalCapitalInStock;

  // Top productos por margen $
  const topProfitable = [...products]
    .filter(p => p.grossMargin > 0)
    .sort((a, b) => b.grossMargin - a.grossMargin)
    .slice(0, 5);

  // Productos a pérdida que requieren acción urgente
  const lossMakingProducts = products
    .filter(p => p.status === 'LOSS')
    .sort((a, b) => a.grossMargin - b.grossMargin);

  return {
    totalProducts: products.length,
    totalStockUnits,
    totalCapitalInStock: Number(totalCapitalInStock.toFixed(2)),
    totalPotentialRevenue: Number(totalPotentialRevenue.toFixed(2)),
    totalPotentialMargin: Number(totalPotentialMargin.toFixed(2)),
    averageMarginPercentage: Number(averageMarginPercentage.toFixed(2)),
    averageMarkupPercentage: Number(averageMarkupPercentage.toFixed(2)),
    lossCount,
    criticalCount,
    healthyCount,
    missingCostCount,
    topProfitable,
    lossMakingProducts
  };
}

module.exports = {
  calculateProductMetrics,
  calculateSummaryMetrics
};

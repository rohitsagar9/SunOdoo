import Decimal from 'decimal.js';
import type { Product, ProductCategory, SystemType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export interface BomLine {
  sku: string;
  quantity: number;
}

export interface PricedItem {
  productId: string;
  description: string;
  category: ProductCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface PricedQuote {
  items: PricedItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  advanceAmount: number;
}

/**
 * Ready-made bill of materials for 1 kW to 5 kW systems.
 * Nobody has to remember the small parts: panels, inverter, structure,
 * cables, connectors, earthing, distribution boxes, lightning arrester,
 * installation and commissioning are added automatically.
 */
export function buildBom(capacityKw: number, systemType: SystemType): BomLine[] {
  const kw = Math.min(5, Math.max(1, Math.round(capacityKw)));
  const panels = Math.ceil((kw * 1000) / 540);
  const lines: BomLine[] = [
    { sku: 'PANEL-540W', quantity: panels },
    { sku: `INV-${kw}K`, quantity: 1 },
    { sku: `STR-${kw}K`, quantity: 1 },
    { sku: 'CABLE-DC-4MM', quantity: Math.max(20, kw * 12) },
    { sku: 'CABLE-AC-4MM', quantity: 15 },
    { sku: 'MC4-PAIR', quantity: Math.max(4, panels) },
    { sku: 'EARTH-KIT', quantity: 1 },
    { sku: 'ACDB-3K', quantity: 1 },
    { sku: 'DCDB-3K', quantity: 1 },
    { sku: 'LA-KIT', quantity: 1 },
    { sku: 'INSTALL-KW', quantity: kw },
    { sku: 'COMMISSIONING', quantity: 1 },
  ];

  if (systemType === 'OFF_GRID') {
    lines.push(
      { sku: kw <= 3 ? 'BAT-2.4K' : 'BAT-5K', quantity: kw <= 3 ? 1 : 2 },
      { sku: 'CC-60A', quantity: 1 },
    );
  }

  return lines;
}

export async function priceBom(
  capacityKw: number,
  systemType: SystemType,
  discount = 0,
  taxRate = 13.8,
): Promise<PricedQuote> {
  const lines = buildBom(capacityKw, systemType);
  const products = await prisma.product.findMany({
    where: { sku: { in: lines.map((line) => line.sku) }, active: true },
  });
  const bySku = new Map<string, Product>(products.map((product) => [product.sku, product]));
  const missing = lines.filter((line) => !bySku.has(line.sku));

  if (missing.length > 0) {
    throw new AppError(
      500,
      `Quote template is missing catalog items: ${missing.map((item) => item.sku).join(', ')}`,
      'CATALOG_INCOMPLETE',
    );
  }

  const items: PricedItem[] = lines.map((line, index) => {
    const product = bySku.get(line.sku)!;
    const total = new Decimal(product.unitPrice).times(line.quantity).toDecimalPlaces(0).toNumber();
    return {
      productId: product.id,
      description: product.name,
      category: product.category,
      quantity: line.quantity,
      unit: product.unit,
      unitPrice: product.unitPrice,
      total,
      sortOrder: index,
    };
  });

  const subtotal = items.reduce((sum, item) => sum.plus(item.total), new Decimal(0));
  const safeDiscount = new Decimal(Math.max(0, discount));
  const taxable = Decimal.max(subtotal.minus(safeDiscount), 0);
  const taxAmount = taxable.times(taxRate).dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const total = taxable.plus(taxAmount).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const advanceAmount = total.times(0.3).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return {
    items,
    subtotal: subtotal.toNumber(),
    discount: safeDiscount.toNumber(),
    taxRate,
    taxAmount: taxAmount.toNumber(),
    total: total.toNumber(),
    advanceAmount: advanceAmount.toNumber(),
  };
}

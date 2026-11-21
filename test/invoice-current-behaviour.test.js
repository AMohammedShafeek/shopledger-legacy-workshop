'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function sampleOrder() {
  const items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  const billed = pricing.computeTotals(items, 'WELCOME');

  return {
    id: 1001,
    date: '21/11/2026',
    customer: 'Sample Customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('CURRENT BEHAVIOUR: order pricing resolves the 1006 HSN slab and caps WELCOME discount', () => {
  const item = { id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 };
  const billed = pricing.computeTotals([item], 'WELCOME');

  assert.equal(tax.getRateForItem(item), 0.05);
  assert.equal(billed.subtotal, 3000);
  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 145);
  assert.equal(billed.cgst, 72.5);
  assert.equal(billed.sgst, 72.5);
  assert.equal(billed.total, 3045);
});

test('invoice figures match the GST, discount, and total billed by order pricing', () => {
  const order = sampleOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 3000);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 145);
  assert.equal(figures.cgst, 72.5);
  assert.equal(figures.sgst, 72.5);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 3045);
  assert.equal(order.total, 3045);
});

test('invoice HTML displays the billed total without a reconciliation warning', () => {
  const order = sampleOrder();
  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹3045\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation matches the billed figures from in-memory data', () => {
  const order = sampleOrder();
  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

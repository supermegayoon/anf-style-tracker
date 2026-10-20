// Runs the API test, then keeps the seeded server up for a UI check.
process.env.KEEP = '1';
const { base } = await import('./test.js');
console.log('UI at ' + base);

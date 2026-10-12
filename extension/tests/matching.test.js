import test from 'node:test';
import assert from 'node:assert/strict';
import { rankProducts, packQuantity, matchShoppingList, proposalRows } from '../matching.js';
const product = (name, size, price, id = 1) => ({ name, size, price, url: `https://groceries.morrisons.com/products/product/${id}`, canAdd: true, availability: 'addable' });
const rice = { key: 'rice', name: 'basmati rice', label: '750g basmati rice', amounts: [{unit: 'g', quantity: 750}] };

test('matching selects a suitable economical size and excludes ready rice', () => {
  const candidates = rankProducts(rice, [product('Morrisons Microwave Basmati Rice','250g','£0.75'), product('Morrisons Basmati Rice','500g','£1.20',2), product('Morrisons Basmati Rice','1kg','£1.79',3)]);
  assert.equal(candidates[0].size,'1kg'); assert.equal(candidates[0].packs,1);
  assert.equal(candidates.length,2);
});

test('saved choices are preferred only when compatible and currently addable', () => {
  const preferred=product('Morrisons Basmati Rice','500g','£1.20',2);
  assert.equal(rankProducts(rice,[preferred,product('Morrisons Basmati Rice','1kg','£1.79',3)],preferred)[0].url,preferred.url);
  assert.equal(rankProducts(rice,[{...preferred,canAdd:false}],preferred).length,0);
});

test('matching does not silently replace a fresh aromatic with a sauce or biscuit', () => {
  const ginger={name:'fresh ginger',amounts:[{unit:'g',quantity:15}]};
  assert.equal(rankProducts(ginger,[product('Morrisons Ginger Biscuits','200g','£1'),product('Morrisons Ginger Paste','100g','£1'),product('Morrisons Ginger','100g','£0.80',3)]).length,1);
  assert.equal(rankProducts({name:'ground cumin',amounts:[]},[product('Morrisons Cumin Seeds','40g','£1')]).length,0);
  assert.equal(rankProducts({name:'boneless skinless chicken thighs',amounts:[]},[product('Morrisons Chicken Thighs','1kg','£2')]).length,0);
});

test('pack counts cover weights, multipacks, tins, liquids and counted produce', () => {
  assert.equal(packQuantity(rice,product('rice','2 x 500g','£2')).packs,1);
  assert.equal(packQuantity({amounts:[{unit:'tin:400:g',quantity:1.5}]},product('chickpeas','400g','£0.50')).packs,2);
  assert.equal(packQuantity({amounts:[{unit:'count',quantity:6}]},product('lemons','4 per pack','£1')).packs,2);
  assert.equal(packQuantity({amounts:[{unit:'count',quantity:3}]},product('onion','each','£0.20')).packs,3);
  assert.equal(packQuantity({amounts:[{unit:'tsp',quantity:12}]},product('oil','250ml','£1')).packs,1);
  assert.equal(packQuantity({amounts:[{unit:'count',quantity:2}]},product('carrots','500g','£0.50')).estimated,true);
});

test('the entire ingredient batch is searched without saved preferences', async () => {
  const queries=[];
  const rows=await matchShoppingList([rice,{...rice,key:'second'}],{}, {progress:async()=>{},search:async(item,query)=>{queries.push(query);return {products:[product('Morrisons Basmati Rice','1kg','£1.79')]};}});
  assert.equal(queries.length,2); assert.ok(rows.every(row=>row.selected && row.target===1));
});

test('duplicate automatic choices combine before rounding, while manual counts remain respected', () => {
  const candidate={...product('Rice','1kg','£1'),estimated:false};
  const rows=[{item:{...rice,amounts:[{unit:'g',quantity:600}]},candidates:[candidate],selected:candidate.url,target:1}, {item:{...rice,key:'b',amounts:[{unit:'g',quantity:300}]},candidates:[candidate],selected:candidate.url,target:1}];
  assert.equal(proposalRows(rows)[0].target,1);
  rows[0].quantityEdited=true; assert.equal(proposalRows(rows)[0].target,2);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../previews/assets/banner-date-picker.js'),I=require('../previews/assets/banner-image-upload.js');
test('calendar aligns Monday first, leap years and month/year navigation without local timezone drift',()=>{
 assert.equal(D.cells('2026-10').filter(Boolean).length,31);assert.equal(D.cells('2026-10').indexOf('2026-10-01'),3);
 assert.equal(D.cells('2028-02').filter(Boolean).length,29);assert.equal(D.cells('2027-02').filter(Boolean).length,28);
 assert.equal(D.shift('2026-12',1),'2027-01');assert.equal(D.shift('2027-01',-1),'2026-12');
});
test('date validity enforces exact Beijing minute and minimum, including impossible days',()=>{
 const min='2026-10-22T10:01';assert(D.valid(min,min));assert(!D.valid('2026-10-22T10:00',min));assert(!D.valid('2026-11-31T11:00',min));assert(!D.valid('2026-10-23T24:00',min));assert(D.valid('2027-01-01T00:00',min));
});
test('upload accepts actual PNG/JPEG headers rather than trusting the filename',()=>{
 assert.equal(I.kind(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');assert.equal(I.kind(Uint8Array.from([255,216,255,224])),'image/jpeg');assert.equal(I.kind(Uint8Array.from([71,73,70,56])),null);assert.equal(I.kind(new Uint8Array()),null);
 assert(I.message({width:400,height:800}).includes('建议使用横向图片'));assert(I.message({width:800,height:400}).includes('800 × 400'));assert(!I.message({width:800,height:400}).includes('建议使用横向图片'));
});

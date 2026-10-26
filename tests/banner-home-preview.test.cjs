'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('previews/assets/banner-preview.js','utf8'),css=fs.readFileSync('previews/assets/banner-preview.css','utf8');
test('Banner preview reuses V01 instead of maintaining a parallel home design',()=>{
 assert(app.includes('src="v01-v02.html?banner-preview=1"'));assert(app.includes("doc?.getElementById('home-phone')"));
 assert(!app.includes('home-sk-categories'));assert(!css.includes('home-sk-categories'));
 assert(app.includes('openPreviewDetails'));assert(app.includes('f.publicAddress?'));assert(app.includes('f.publicPhone?'));
});
test('embedded home only replaces ad and feed content and makes unrelated live controls inert',()=>{
 assert(app.includes("['#search-form','#sticky-filters','.tabbar']"));assert(app.includes('home.querySelector(sel).inert=true'));
 assert(app.includes('home-preview-skeleton'));assert(app.includes("frame.dataset.ready='true'"));assert(css.includes('.content.is-home-context{padding:0}'));
});

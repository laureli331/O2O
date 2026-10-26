'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('previews/assets/banner-preview.js','utf8'),css=fs.readFileSync('previews/assets/banner-preview.css','utf8');
test('home scene uses static surrounding skeletons and preserves actual creative with expandable details',()=>{
 for(const token of ['home-sk-search','home-sk-categories','home-sk-feed','home-scene-nav','homePlacement(f,label,pos)','preview-ad-details'])assert(app.includes(token),token);
 assert(app.includes('cover(f,label)'));assert(app.includes('detail.open=true'));assert(css.includes('.home-ad-open .banner-cover{height:auto;aspect-ratio:20/11;object-fit:contain;'));
 assert(!css.includes('@keyframes'));assert(app.includes('f.publicAddress?'));assert(app.includes('f.publicPhone?'));
});

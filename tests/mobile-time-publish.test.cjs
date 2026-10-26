'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),N=require('../previews/assets/publish-navigation.js');
const read=p=>fs.readFileSync('previews/'+p,'utf8');
test('publish return destinations are restricted to known local pages',()=>{
 const origin='http://127.0.0.1:8765';assert.equal(N.safeSource('services.html?tab=mine',origin),'services.html?tab=mine');assert.equal(N.safeSource(origin+'/v23.html',origin),'v23.html');
 for(const bad of ['https://example.com/v23.html','//example.com/v05.html','javascript:alert(1)','v04.html','../other.html'])assert.equal(N.safeSource(bad,origin),null,bad);
});
test('time controls stay inside custom scroll columns and never create native select menus',()=>{
 const s=read('assets/banner-date-picker.js');assert(s.includes('data-time-column'));assert(s.includes('role="listbox"'));assert(!s.includes('<select'));assert(s.includes("['ArrowUp','ArrowDown','Home','End']"));
});
test('homepage placeholder has an actual cooperation destination while merchant embedded preview removes navigation',()=>{
 assert(read('v01-v02.html').includes('href="ad-cooperation.html"'));assert(read('assets/banner-preview.js').includes("banner.removeAttribute('href')"));assert(read('ad-cooperation.html').includes('BannerModel.price(i,d)'));
});
test('every current main tab-bar host loads the shared independent-publish entry',()=>{
 for(const file of ['v01-v02.html','v23.html','services.html','v05.html','v07.html'])assert(read(file).includes('assets/publish-navigation.js'),file);
 const s=read('v04.html');assert(s.includes("$('entry-tabs').hidden=true"));assert(!s.includes('id="flow-close"'));assert(s.includes('id="form-close"'));assert(s.includes('function exitPublish'));
});

test('merchant publishing retains its own full-screen editor and exit protection',()=>{const s=read('v23.html');assert(s.includes('merchant-publish-standalone'));assert(s.includes('merchant-exit-dialog'));assert(s.includes('merchantFingerprint()===merchantBaseline'));assert(read('assets/publish-navigation.js').includes('entry=merchant&role='));assert(read('assets/merchant-publish-page.css').includes('.tabbar{display:none!important}'));});

test('resident publishing fills a simulated miniapp phone rather than the desktop browser',()=>{const css=read('assets/publish-page.css');assert(css.includes('@media(min-width:681px)'));assert(css.includes('width:416px'));assert(css.includes('height:min(850px,calc(100dvh - 48px))'));assert(read('v04.html').includes("$('form-phone').querySelector('.phone-head').append(capsule)"));});

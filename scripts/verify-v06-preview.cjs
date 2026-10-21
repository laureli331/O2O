'use strict';
// Historical CLI alias. New verification uses verify-v23-preview.cjs.
if(process.argv[2]){
 const target=new URL(process.argv[2]);
 if(target.pathname.endsWith('/v06.html'))target.pathname=target.pathname.slice(0,-8)+'v23.html';
 process.argv[2]=target.href;
}
require('./verify-v23-preview.cjs');

const fs=require('fs');
function load(name){
  const rows=fs.readFileSync(__dirname+'/../data/'+name+'.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
  const m={};
  rows.forEach(r=>{const o=+r[1],h=+r[2],l=+r[3],c=+r[4];if(o>0&&h>0&&l>0&&c>0&&h>=l)m[r[0]]={o,h,l,c,v:+r[5]||0};});
  return m;
}
function align(names,from){
  const d=names.map(load);
  let dates=Object.keys(d[0]).filter(x=>names.every((n,i)=>d[i][x])).sort();
  if(from)dates=dates.filter(x=>x>=from);
  return {dates,bars:dates.map(x=>{const o={};names.forEach((n,i)=>o[n]=d[i][x]);return o})};
}
module.exports={load,align};

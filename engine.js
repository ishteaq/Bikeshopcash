/* Shop Manager — in-browser engine (replaces server.py). Data lives in IndexedDB on this device. */
(function(G){
const MN='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const KEYS={products:'code name cat unit buy sell min sup open active brand',purchases:'date code qty cost sup inv',memos:'no date cust phone disc paid method words note',items:'no code qty price buy',dues:'date memo amount method note',running:'date cat desc amount paidto',fixed:'date cat item amount note',capital:'date type amount note partner'};
const SHEETS={products:['Products',[1,2,3,4,5,6,7,8,9,10,12]],purchases:['Purchases',[1,2,4,5,7,8]],memos:['Sales_Memo',[1,2,3,4,6,8,11,12,13]],items:['Sales_Items',[1,3,5,6,7]],dues:['Due_Payments',[1,2,3,4,5]],running:['Running_Costs',[1,2,3,4,5]],fixed:['Fixed_Costs',[1,2,3,4,5]],capital:['Owner_Capital',[1,2,3,4,5]]};
const NUMK=new Set('buy sell min open qty cost disc paid price amount'.split(' '));
const LISTCOL={cat:['Product Categories',4],unit:['Units',5],method:['Payment Methods',6],run:['Running Cost Categories',7],fixed:['Fixed Cost Categories',8]};
const num=x=>typeof x==='number'&&isFinite(x)?x:0,P2=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);
const addD=(s,n)=>{const[y,m,d]=s.split('-').map(Number);return iso(y,m-1,d+n)},diff=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const todayS=()=>{const n=new Date();return iso(n.getFullYear(),n.getMonth(),n.getDate())};
class Err extends Error{}
/* ---------- storage ---------- */
let dbp=null,mem={};
const idb=()=>dbp||(dbp=new Promise((res,rej)=>{if(typeof indexedDB==='undefined')return rej();const r=indexedDB.open('shopmanager',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
async function kvGet(k){try{const d=await idb();return await new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}catch(e){return mem[k]}}
async function kvSet(k,v){try{const d=await idb();await new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){mem[k]=v}}
const blank=()=>({v:1,settings:{shop:'My Shop',address:'',phone:'',prefix:'INV-',cur:'৳',low:5,year:new Date().getFullYear(),cash:0,y0:new Date().getFullYear(),maxdisc:10,maxjump:20,logo:'',
 lists:{cat:['General'],unit:['Pcs','Kg','Box','Set','Litre','Pair'],method:['Cash','bKash','Nagad','Card','Bank'],run:['Electricity','Internet','Salary','Rent','Transport','Other'],fixed:['Decoration','Furniture','Equipment','Repair','Materials','Other']},
 partners:[{name:'Partner 1',share:100/3},{name:'Partner 2',share:100/3},{name:'Partner 3',share:100/3}]},
 products:[],purchases:[],memos:[],items:[],dues:[],running:[],fixed:[],capital:[]});
let DB=null;const persist=()=>kvSet('db',DB);
const ready=(async()=>{DB=await kvGet('db')||blank()})();
/* ---------- words (lakh / crore) ---------- */
const O='Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen'.split(' '),T='X X Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety'.split(' ');
function w_(n){if(n<20)return O[n];if(n<100)return T[Math.floor(n/10)]+(n%10?' '+O[n%10]:'');for(const[d,nm]of[[1e7,'Crore'],[1e5,'Lakh'],[1e3,'Thousand'],[100,'Hundred']])if(n>=d){const q=Math.floor(n/d),r=n%d;return w_(q)+' '+nm+(r?' '+w_(r):'')}}
const words=x=>{const n=Math.round(x);return n?'Taka '+w_(n)+' Only':'Taka Zero Only'};
/* ---------- state ---------- */
function state(rsIn){
const td=todayS(),rs=(rsIn&&rsIn.length?rsIn:[[td.slice(0,8)+'01',td]]).map(([a,b])=>[a,addD(b,1)]);
const f=rs.map(x=>x[0]).sort()[0],e=rs.map(x=>x[1]).sort().pop(),t=addD(e,-1),st=DB.settings;
const P=DB.products.map(x=>({...x})),M=DB.memos.map(x=>({...x})),I=DB.items.map(x=>({...x})),pur=DB.purchases,DU=DB.dues,RC=DB.running,FC=DB.fixed,CP=DB.capital;
const md={};M.forEach(m=>md[m.no]=m);const D0=()=>({}),prof=D0(),sold=D0(),bought=D0(),sub=D0(),later=D0(),add=(o,k,v)=>o[k]=(o[k]||0)+v;
I.forEach(i=>{i.date=(md[i.no]||{}).date;i.total=num(i.qty)*num(i.price);i.cost=num(i.qty)*num(i.buy);add(sold,i.code,num(i.qty));add(sub,i.no,i.total);add(prof,i.no,i.total-i.cost)});
pur.forEach(p=>add(bought,p.code,num(p.qty)));DU.forEach(d=>add(later,d.memo,num(d.amount)));
const pname={};P.forEach(p=>{pname[p.code]=p.name;p.stock=num(p.open)+(bought[p.code]||0)-(sold[p.code]||0);p.sold=sold[p.code]||0;p.value=p.stock*num(p.buy);p.margin=num(p.sell)?(num(p.sell)-num(p.buy))/num(p.sell):0;
 const mn=typeof p.min==='number'?p.min:num(st.low);p.status=p.stock<=0?'OUT':p.stock<=mn?'LOW':'OK'});
const byNo={};I.forEach(i=>(byNo[i.no]=byNo[i.no]||[]).push(i));
M.forEach(m=>{m.sub=sub[m.no]||0;m.grand=m.sub-num(m.disc);m.later=later[m.no]||0;m.due=m.grand-num(m.paid)-m.later;m.profit=(prof[m.no]||0)-num(m.disc);
 m.items=(byNo[m.no]||[]).map(i=>({code:i.code,name:pname[i.code]||'?',qty:i.qty,price:i.price,total:i.total}))});
const S0=(l,fn)=>l.reduce((a,x)=>a+fn(x),0);
function per(s,e,label){const f=d=>d&&d>=s&&d<e,g=S0(I.filter(i=>f(i.date)),i=>i.total),dc=S0(M.filter(m=>f(m.date)),m=>num(m.disc)),cg=S0(I.filter(i=>f(i.date)),i=>i.cost),
 ru=S0(RC.filter(x=>f(x.date)),x=>num(x.amount)),fx=S0(FC.filter(x=>f(x.date)),x=>num(x.amount)),pu=S0(pur.filter(x=>f(x.date)),x=>num(x.qty)*num(x.cost)),cs=S0(M.filter(m=>f(m.date)),m=>num(m.paid)),
 du=S0(DU.filter(x=>f(x.date)),x=>num(x.amount)),ci=S0(CP.filter(x=>f(x.date)&&x.type==='Capital In'),x=>num(x.amount)),dr=S0(CP.filter(x=>f(x.date)&&x.type==='Owner Drawing'),x=>num(x.amount));
 const net=g-dc,gp=net-cg,op=gp-ru,cin=cs+du+ci,cout=pu+ru+fx+dr;
 return{label,gross:g,disc:dc,net,cogs:cg,gp,run:ru,op,fixed:fx,after:op-fx,cashSale:cs,dues:du,capIn:ci,purch:pu,draw:dr,cashIn:cin,cashOut:cout,cashNet:cin-cout,reinv:pu+fx,invGrowth:pu-cg,rate:net?(pu+fx)/net:0,kept:op-dr}}
const y=Math.round(num(+st.year)),mon=[];let cash=num(+st.cash);
for(let m=1;m<=12;m++){const r=per(iso(y,m-1,1),iso(y,m,1),MN[m-1]);cash+=r.cashNet;r.close=cash;mon.push(r)}
const wd=(new Date(td).getUTCDay()+6)%7,mo=addD(td,-wd),lab=s=>P2(+s.slice(8))+' '+MN[+s.slice(5,7)-1];
const wk=[];for(let k=11;k>=0;k--){const s=addD(mo,-7*k);wk.push(per(s,addD(s,7),lab(s)))}
const y0=Math.round(num(+st.y0)),yr=[];for(let k=0;k<5;k++)yr.push(per(iso(y0+k,0,1),iso(y0+k+1,0,1),String(y0+k)));
const SM=k=>S0(mon,x=>x[k]),kpi={net:SM('net'),gp:SM('gp'),op:SM('op'),reinv:SM('reinv'),cash,due:S0(M,m=>m.due),stock:S0(P,p=>p.value),low:P.filter(p=>p.status!=='OK').length};
const cat={};P.forEach(p=>cat[p.code]=p.cat);const sc={},ec={},deb={},sr={},yy=d=>d&&rs.some(([a,b])=>d>=a&&d<b);
I.forEach(i=>{if(yy(i.date)){add(sc,cat[i.code]||'?',i.total);add(sr,i.code,num(i.qty))}});RC.concat(FC).forEach(x=>{if(yy(x.date))add(ec,x.cat,num(x.amount))});
M.forEach(m=>{if(m.due>.001)add(deb,m.cust||'Walk-in',m.due)});
const dd=[];for(let k=13;k>=0;k--){const s=addD(td,-k);dd.push(per(s,addD(s,1),P2(+s.slice(8))))}
const tot=S0(rs,([a,b])=>diff(a,b));
const mk=(a,b)=>{const out=[];if(tot<=62){for(let k=0;k<diff(a,b);k++){const s=addD(a,k);out.push(per(s,addD(s,1),lab(s)))}return out}
 let mm=a.slice(0,8)+'01';while(mm<b){const nx=iso(+mm.slice(0,4),+mm.slice(5,7),1);out.push(per(mm>a?mm:a,nx<b?nx:b,MN[+mm.slice(5,7)-1]+' '+mm.slice(2,4)));mm=nx}return out};
const ser=[].concat(...rs.map(([a,b])=>mk(a,b))),rr=rs.map(([a,b])=>per(a,b,'r')),rg={};Object.keys(rr[0]).forEach(k=>{if(k!=='label')rg[k]=S0(rr,x=>x[k])});rg.label='r';rg.rate=rg.net?rg.reinv/rg.net:0;
const life=per('2000-01-01','2100-01-01','All'),pt=st.partners.filter(p=>p.name).map(p=>({name:p.name,share:num(+p.share)}));
const lines=I.map(i=>[i.date,i.code,num(i.qty),i.total,i.cost,i.no]),srt=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
return{shop:st.shop,address:st.address,phone:st.phone,prefix:st.prefix,cur:st.cur,low:st.low,year:st.year,cash:st.cash,y0:st.y0,logo:st.logo,lists:{...st.lists,partner:pt.map(p=>p.name)},today:dd[13],rng:rg,series:ser,life,partners:pt,lines,f,t,
 rs:rs.map(([a,b])=>[a,addD(b,-1)]),month:+td.slice(0,4)===y?mon[+td.slice(5,7)-1]:null,daily:dd,salecat:srt(sc),expcat:srt(ec),debtors:srt(deb).slice(0,6),maxdisc:st.maxdisc||10,maxjump:st.maxjump||20,
 products:P,purchases:pur.slice().reverse(),memos:M.slice().reverse(),running:RC.slice().reverse(),fixed:FC.slice().reverse(),capital:CP.slice().reverse(),monthly:mon,weekly:wk,yearly:yr,kpi,
 top:P.map(p=>({name:p.name,sold:sr[p.code]||0})).sort((a,b)=>b.sold-a.sold).filter(p=>p.sold>0).slice(0,10),low_list:P.filter(p=>p.status!=='OK').slice(0,15)}}
/* ---------- writes ---------- */
const pick=(k,d)=>{const o={};KEYS[k].split(' ').forEach(x=>o[x]=d[x]===undefined||d[x]===''?null:d[x]);return o};
async function addv(k,d){
 if(!KEYS[k]||k==='memos'||k==='items')throw new Err('Bad request');const codes=new Set(DB.products.map(p=>p.code));
 if(k==='products'&&codes.has(d.code))throw new Err('Product code already exists');
 if(k==='purchases'){if(!codes.has(d.code))throw new Err('Unknown product code');if(d.upd){const p=DB.products.find(p=>p.code===d.code);p.buy=d.cost}}
 if(k==='capital'&&!d.partner)throw new Err('Choose a partner');
 if(['running','fixed','capital'].includes(k)&&num(d.amount)<=0)throw new Err('Amount must be above 0');
 if(k==='dues'){const mm=state().memos.find(m=>m.no===d.memo);if(!mm)throw new Err('Unknown memo number');if(num(d.amount)<=0||num(d.amount)>mm.due+.001)throw new Err(`Amount must be between 0 and the due (${+mm.due.toFixed(2)})`)}
 DB[k].push(pick(k,d));await persist();return{ok:1}}
async function stockin(d){
 const pr=DB.products.find(p=>p.code===d.code),qty=num(+d.qty),buy=num(+d.buy),sell=num(+d.sell),op=num(+d.open);
 if(Math.min(qty,buy,sell,op)<0)throw new Err('Negative numbers are not allowed');if(buy<=0||sell<=0)throw new Err('Buy price and sell price are required');
 const mn=d.min===''||d.min==null?null:num(+d.min);
 if(!pr){if(!d.name)throw new Err('New product: enter a name');if(qty+op<=0)throw new Err('Enter quantity bought or opening stock');
  DB.products.push({code:d.code,name:d.name,cat:d.cat||null,unit:d.unit||null,buy,sell,min:mn,sup:d.sup||null,open:op,active:'Y',brand:d.brand||null})}
 else{pr.buy=buy;pr.sell=sell;if(d.brand)pr.brand=d.brand;if(mn!==null)pr.min=mn}
 if(qty>0)DB.purchases.push({date:d.date,code:d.code,qty,cost:buy,sup:d.sup||null,inv:d.inv||null});await persist();return{ok:1}}
async function sale(d){
 const S=state(),pr={};S.products.forEach(p=>pr[p.code]=p),need={};
 if(!d.items||!d.items.length)throw new Err('Add at least one item');if(!String(d.cust||'').trim())throw new Err('Customer name is required');
 const ph=String(d.phone||'').trim();if(ph&&!/^\d{11}$/.test(ph))throw new Err('Phone number must be exactly 11 digits');
 for(const i of d.items){if(!pr[i.code])throw new Err('Unknown product '+i.code);if(i.qty<=0||i.price<=0)throw new Err('Qty and price must be above 0');need[i.code]=(need[i.code]||0)+i.qty}
 for(const c in need)if(need[c]>pr[c].stock)throw new Err(`Not enough stock for ${pr[c].name} (have ${+pr[c].stock.toFixed(3)})`);
 const sub=d.items.reduce((a,i)=>a+i.qty*i.price,0),dc=num(+d.disc);if(dc<0||dc>sub)throw new Err('Discount must be between 0 and the subtotal');
 const grand=sub-dc;if(num(+d.paid)>grand+.001)throw new Err('Paid is more than the total');
 const ns=S.memos.map(m=>parseInt(String(m.no).replace(/\D/g,''))||0),no=S.prefix+String(Math.max(0,...ns)+1).padStart(4,'0');
 DB.memos.push({no,date:d.date,cust:d.cust,phone:d.phone||null,disc:dc,paid:num(+d.paid),method:d.method,words:words(grand),note:d.note||null});
 d.items.forEach(i=>DB.items.push({no,code:i.code,qty:i.qty,price:i.price,buy:num(pr[i.code].buy)}));await persist();return{no}}
async function delmemos(ids){
 const s=new Set(ids);if(!s.size)throw new Err('Nothing selected');await kvSet('prev',{time:Date.now(),db:JSON.parse(JSON.stringify(DB))});
 const n=DB.memos.filter(m=>s.has(m.no)).length;DB.memos=DB.memos.filter(m=>!s.has(m.no));DB.items=DB.items.filter(i=>!s.has(i.no));DB.dues=DB.dues.filter(d=>!s.has(d.memo));await persist();return{deleted:n}}
async function call(u,b){await ready;const[p,q]=u.split('?');
 if(p==='/api/state'){const r=/(?:^|&)r=([^&]*)/.exec(q||'');const rs=r&&r[1]?decodeURIComponent(r[1]).split(',').map(x=>x.split('_')):null;return state(rs)}
 if(p==='/api/sale')return sale(b);if(p==='/api/stockin')return stockin(b);if(p==='/api/delete')return delmemos(b.ids);
 if(p.startsWith('/api/add/'))return addv(p.split('/').pop(),b);throw new Err('Bad path')}
/* ---------- settings / import / export ---------- */
async function saveSettings(o){const s=DB.settings;['shop','address','phone','prefix','cur','logo'].forEach(k=>{if(o[k]!==undefined)s[k]=o[k]});['low','year','cash','y0','maxdisc','maxjump'].forEach(k=>{if(o[k]!==undefined&&o[k]!=='')s[k]=+o[k]});
 if(o.lists)Object.keys(o.lists).forEach(k=>s.lists[k]=o.lists[k].filter(Boolean));if(o.partners)s.partners=o.partners;await persist()}
const numify=x=>{const t=String(x).replace(/[৳,%]/g,'').replace(/,/g,'').trim();return/^-?(0|[1-9]\d*)(\.\d+)?$/.test(t)?Number(t):x};
const XL='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function exportBlob(d){const ws=XLSX.utils.aoa_to_sheet([d.head,...d.rows.map(r=>r.map(numify))]);ws['!cols']=d.head.map((h,i)=>({wch:Math.min(40,Math.max(String(h).length,...d.rows.slice(0,200).map(r=>String(r[i]??'').length))+3)}));
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,String(d.title||'Data').replace(/[\\\/*?:\[\]]/g,'').slice(0,30)||'Data');return new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:XL})}
function backupBlob(){const wb=XLSX.utils.book_new(),S=DB.settings,A=[],put=(r,c,v)=>{(A[r-1]=A[r-1]||[])[c-1]=v};put(1,1,'SHOP SETTINGS');
 [['Shop name',S.shop],['Address',S.address],['Phone',S.phone],['Memo prefix',S.prefix],['Currency symbol',S.cur],['Default low-stock threshold',S.low],['Report year',S.year],['Opening cash',S.cash],['First year',S.y0],['Max discount %',S.maxdisc],['Max buy-price change %',S.maxjump]].forEach((x,i)=>{put(3+i,1,x[0]);put(3+i,2,x[1])});
 for(const k in LISTCOL){put(2,LISTCOL[k][1],LISTCOL[k][0]);S.lists[k].forEach((v,i)=>put(3+i,LISTCOL[k][1],v))}put(2,9,'Partners');put(2,10,'Profit Share %');S.partners.forEach((p,i)=>{put(3+i,9,p.name);put(3+i,10,p.share)});
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(A),'Settings');
 for(const k in SHEETS){const[nm,cols]=SHEETS[k],ks=KEYS[k].split(' '),rows=[[]];cols.forEach((c,i)=>rows[0][c-1]=ks[i]);DB[k].forEach(o=>{const r=[];cols.forEach((c,i)=>r[c-1]=o[ks[i]]??undefined);rows.push(r)});XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),nm)}
 return new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:XL})}
const toIso=v=>{if(v==null||v==='')return null;if(typeof v==='number')return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10);if(v instanceof Date)return iso(v.getFullYear(),v.getMonth(),v.getDate());const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));return m?m[0]:String(v)};
async function importBuf(buf){const wb=XLSX.read(buf,{type:'array'});if(!wb.Sheets.Products&&!wb.Sheets.Settings)throw new Err('This does not look like a ShopManager workbook');
 const nd=blank(),S=wb.Sheets.Settings,cv=(ws,r,c)=>{const x=ws[XLSX.utils.encode_cell({r,c})];return x?x.v:undefined};
 if(S){const sv=(r,d)=>{const x=cv(S,r-1,1);return x===undefined||x===''?d:x},s=nd.settings;
  Object.assign(s,{shop:String(sv(3,s.shop)),address:String(sv(4,'')),phone:String(sv(5,'')),prefix:String(sv(6,'INV-')),cur:String(sv(7,'৳')),low:num(+sv(8,5)),year:num(+sv(9,s.year)),cash:num(+sv(10,0)),y0:num(+sv(11,s.y0)),maxdisc:num(+sv(12,10))||10,maxjump:num(+sv(13,20))||20});
  for(const k in LISTCOL){const a=[];for(let r=2;r<22;r++){const x=cv(S,r,LISTCOL[k][1]-1);if(x!==undefined&&x!=='')a.push(String(x))}if(a.length)s.lists[k]=a}
  const pp=[];for(let r=2;r<7;r++){const n=cv(S,r,8);if(n)pp.push({name:String(n),share:num(+cv(S,r,9))})}if(pp.length)s.partners=pp}
 for(const k in SHEETS){const ws=wb.Sheets[SHEETS[k][0]];if(!ws||!ws['!ref'])continue;const rg=XLSX.utils.decode_range(ws['!ref']),ks=KEYS[k].split(' ');
  for(let r=1;r<=rg.e.r;r++){const o={};SHEETS[k][1].forEach((c,i)=>{const v=cv(ws,r,c-1),key=ks[i];o[key]=key==='date'?toIso(v):NUMK.has(key)?(v===undefined||v===''?(key==='min'?null:0):num(+v)):(v===undefined||v===''?null:String(v))});
   if(o[ks[0]]===null||o[ks[0]]===undefined)continue;if(k==='products'&&!o.active)o.active='Y';nd[k].push(o)}}
 DB=nd;await persist();return{products:nd.products.length,memos:nd.memos.length}}
G.ENG={ready,call,words,state,saveSettings,exportBlob,backupBlob,importBuf,
 get settings(){return DB.settings},get empty(){return!DB.products.length&&!DB.memos.length},
 async hasPrev(){return!!(await kvGet('prev'))},async prevTime(){const p=await kvGet('prev');return p?p.time:0},
 async restorePrev(){const p=await kvGet('prev');if(!p)throw new Err('No backup found');DB=p.db;await persist()},
 async erase(){await kvSet('prev',{time:Date.now(),db:JSON.parse(JSON.stringify(DB))});const s=DB.settings;DB=blank();DB.settings=s;await persist()},
 async sample(){const r=await fetch('sample-data.xlsx');if(!r.ok)throw new Err('sample-data.xlsx not found next to index.html');return importBuf(await r.arrayBuffer())}};
if(typeof module!=='undefined')module.exports=G.ENG;
})(typeof window!=='undefined'?window:globalThis);

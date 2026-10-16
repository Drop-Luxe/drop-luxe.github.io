// DropLux: función Supabase Edge pública, sin claves en el navegador.
// Desplegar solamente tras configurar la DB y Cloudflare Turnstile.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PRICE_LIST } from './prices.ts';
const ORIGIN = 'https://drop-luxe.github.io';
const cors = {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type, authorization, apikey, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(data:object,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
const getText=(x:unknown,max:number)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max?x.trim():null;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Line={id:string,qty:number};
function validate(raw:unknown){
 if(!raw||typeof raw!=='object')return null;
 const x=raw as Record<string,unknown>, addr=x.shipping_address;
 const request_id=getText(x.request_id,64), name=getText(x.customer_name,120), email=getText(x.customer_email,254), phone=getText(x.customer_phone,35)?.replace(/\D/g,'');
 const token=getText(x.turnstile_token,4096);
 if(!request_id||!uuid.test(request_id)||!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!phone||! /^\d{10}$/.test(phone)||!token)return null;
 if(!addr||typeof addr!=='object')return null;
 const a=addr as Record<string,unknown>;
 const cp=getText(a.cp,5), calle=getText(a.calle,200), colonia=getText(a.colonia,120), municipio=getText(a.municipio,100), estado=getText(a.estado,100);
 const referencias=typeof a.referencias==='string'?a.referencias.trim().slice(0,300):'';
 if(!cp||! /^\d{5}$/.test(cp)||!calle||!colonia||!municipio||!estado)return null;
 if(!Array.isArray(x.items)||x.items.length<1||x.items.length>30)return null;
 const counts=new Map<string,number>();
 for(const line of x.items){
  if(!line||typeof line!=='object'||typeof line.id!=='string'||!Object.hasOwn(PRICE_LIST,line.id)||!Number.isInteger(line.qty)||line.qty<1||line.qty>20)return null;
  counts.set(line.id,(counts.get(line.id)||0)+line.qty);
 }
 const cart=[...counts].map(([id,qty])=>({id,qty}));
 if(cart.some(p=>p.qty>20)||cart.reduce((s,p)=>s+p.qty,0)>50)return null;
 return {request_id, customer_name:name, customer_email:email.toLowerCase(), customer_phone:phone, shipping_address:{cp,calle,colonia,municipio,estado,referencias},cart,turnstile_token:token};
}
function calculate(cart:Line[]){
 let subtotal=0,g5=0,original=0,nG5=0,nOriginal=0;
 const items=cart.map(({id,qty})=>{
  const p=PRICE_LIST[id]; const line=p.price*qty; subtotal+=line;
  if(p.type==='G5'){g5+=line;nG5+=qty}else{original+=line;nOriginal+=qty}
  return {id,qty,unit_price_mxn:p.price,line_total_mxn:line};
 });
 const discG5=nG5>=3?Math.round(g5*.08):nG5>=2?Math.round(g5*.05):0;
 const discO=nOriginal>=3?Math.round(original*.08):nOriginal>=2?Math.round(original*.06):0;
 const discount=Math.max(discG5,discO);
 return {items,subtotal,discount,total:subtotal-discount};
}
async function checkCaptcha(token:string,secret:string,ip:string|null){
 const body=new FormData();body.set('secret',secret);body.set('response',token);
 if(ip)body.set('remoteip',ip);
 const resp=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(8500)});
 if(!resp.ok)return false;
 const result=await resp.json() as {success?:boolean;hostname?:string};
 return result.success===true&&result.hostname==='drop-luxe.github.io';
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 if(req.headers.get('origin')!==ORIGIN)return reply({error:'Origen no permitido'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Se requiere JSON'},415);
 if(Number(req.headers.get('content-length')||0)>16000)return reply({error:'Solicitud demasiado larga'},413);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),captcha=Deno.env.get('TURNSTILE_SECRET_KEY');
 if(!url||!key||!captcha)return reply({error:'Registro de pedidos aún no habilitado'},503);
 let rawText:string;
 try{rawText=await req.text()}catch{return reply({error:'Error al leer la solicitud'},400)}
 if(rawText.length>16000)return reply({error:'Solicitud demasiado larga'},413);
 let body:unknown;
 try{body=JSON.parse(rawText)}catch{return reply({error:'Solicitud inválida'},400)}
 const p=validate(body);
 if(!p)return reply({error:'Revisa tus datos y los productos seleccionados'},422);
 // Prueba sin registrar clientes ni consumir folios: requiere CAPTCHA válido de producción.
 const dryRun=(body as Record<string,unknown>).dry_run===true;
 const testOrder=(body as Record<string,unknown>).test_order===true;
 if(dryRun&&testOrder)return reply({error:'Elige una sola modalidad de prueba'},400);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 // Idempotencia: un reintento del mismo pedido recupera el mismo folio, sin datos personales.
 if(!dryRun&&!testOrder){
  const prev=await db.from('droplux_orders').select('folio').eq('request_id',p.request_id).maybeSingle();
  if(prev.data?.folio)return reply({folio:prev.data.folio,registrado:true,pendiente:true});
 }
 if(testOrder){
  const prev=await db.from('droplux_test_orders').select('test_number,total_mxn').eq('request_id',p.request_id).maybeSingle();
  if(prev.error)return reply({error:'No se pudo consultar la prueba'},503);
  if(prev.data)return reply({prueba_pedido_registrado:true,venta_real:false,folio_prueba:'T-'+String(prev.data.test_number).padStart(3,'0'),total_productos_mxn:prev.data.total_mxn});
 }
 let passed=false;
 try{passed=await checkCaptcha(p.turnstile_token,captcha,req.headers.get('cf-connecting-ip'))}catch{return reply({error:'Verificación antispam temporalmente no disponible'},503)}
 if(!passed)return reply({error:'Verificación antispam fallida'},403);
 const a=calculate(p.cart);
 if(dryRun)return reply({prueba_correcta:true,registrado:false,total_productos_mxn:a.total,
  aviso:'Cloudflare y Supabase respondieron. No se guardaron datos y no se consumió ningún folio.'});
 if(testOrder){
  // Almacén aislado: no guardar datos personales, no consumir la serie D de ventas.
  const {data,error}=await db.from('droplux_test_orders').insert({
    request_id:p.request_id,items:a.items,total_mxn:a.total
  }).select('test_number').single();
  if(error){
   if(error.code==='23505'){
    const prev=await db.from('droplux_test_orders').select('test_number,total_mxn').eq('request_id',p.request_id).maybeSingle();
    if(prev.data)return reply({prueba_pedido_registrado:true,venta_real:false,folio_prueba:'T-'+String(prev.data.test_number).padStart(3,'0'),total_productos_mxn:prev.data.total_mxn});
   }
   console.error('Error creando prueba de pedido',error.code);
   return reply({error:'No se pudo guardar la prueba de pedido'},503);
  }
  return reply({prueba_pedido_registrado:true,venta_real:false,folio_prueba:'T-'+String(data.test_number).padStart(3,'0'),total_productos_mxn:a.total,
    aviso:'Pedido de prueba almacenado sin datos personales. No es una venta ni consume folios reales.'},201);
 }
 const {data,error}=await db.from('droplux_orders').insert({
  request_id:p.request_id,customer_name:p.customer_name,customer_phone:p.customer_phone,
  customer_email:p.customer_email,shipping_address:p.shipping_address,items:a.items,
  subtotal_mxn:a.subtotal,discount_mxn:a.discount,shipping_mxn:null,
  total_mxn:a.total,status:'pending_review'
 }).select('folio').single();
 if(error){
  if(error.code==='23505'){
   const retry=await db.from('droplux_orders').select('folio').eq('request_id',p.request_id).maybeSingle();
   if(retry.data?.folio)return reply({folio:retry.data.folio,registrado:true,pendiente:true});
  }
  console.error('Error guardando pedido',error.code);
  return reply({error:'No se pudo guardar el pedido. Inténtalo de nuevo.'},503);
 }
 return reply({folio:data.folio,registrado:true,pendiente:true,total_productos_mxn:a.total,
  aviso:'El envío al cliente está pendiente de cotización. No transfieras antes de recibir confirmación.'},201);
});

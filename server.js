'use strict';
const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:12000});
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(req,res)=>res.json({ok:true,players:players.size}));
const players=new Map(), mobs=new Map(), W=2800,H=2000;
const classes={warrior:{hp:150,atk:18},mage:{hp:100,atk:24},archer:{hp:115,atk:20},rogue:{hp:120,atk:22}};
const mobTypes=[{name:'สไลม์',hp:55,atk:6,xp:12},{name:'หมาป่า',hp:85,atk:9,xp:20},{name:'โกเลม',hp:160,atk:13,xp:35}];
for(let i=0;i<45;i++){let t=i%3,m=mobTypes[t];mobs.set('m'+i,{id:'m'+i,type:t,x:180+Math.random()*(W-360),y:180+Math.random()*(H-360),hp:m.hp,maxHp:m.hp,alive:true,respawn:0});}
const dbFile=path.join(__dirname,'data','characters.json');let db={};try{db=JSON.parse(fs.readFileSync(dbFile,'utf8'))}catch{};
let dirty=false;function save(){if(!dirty)return;try{fs.mkdirSync(path.dirname(dbFile),{recursive:true});fs.writeFileSync(dbFile,JSON.stringify(db));dirty=false}catch(e){console.error('Save error:',e.message)}}setInterval(save,20000);
const clean=s=>String(s||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24);
const publicPlayer=p=>({id:p.id,name:p.name,job:p.job,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,level:p.level,skin:p.skin});
const publicMob=m=>({id:m.id,type:m.type,x:m.x,y:m.y,hp:m.hp,maxHp:m.maxHp,alive:m.alive});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function profile(p){return {level:p.level,xp:p.xp,gold:p.gold,gems:p.gems,stones:p.stones,pity:p.pity,inventory:p.inventory,weapon:p.weapon,skin:p.skin,job:p.job,hp:p.hp,maxHp:p.maxHp}};
function persist(p){db[p.key]={...profile(p),name:p.name};dirty=true;}
function state(){return {players:[...players.values()].map(publicPlayer),mobs:[...mobs.values()].map(publicMob)}};
function emitStats(p){io.to(p.id).emit('stats',profile(p));persist(p)}
const rewards=['หมวกดาว','ชุดนักผจญภัย','ปีกจันทรา','ออร่าทอง','ชุดจอมเวท','ผ้าคลุมมังกร'];
io.on('connection',s=>{
 s.on('join',(raw,cb)=>{if(players.has(s.id))return;let name=clean(raw?.name),job=classes[raw?.job]?raw.job:'warrior',token=String(raw?.token||'');if(!name||name.length<2)return cb?.({error:'กรุณาใส่ชื่ออย่างน้อย 2 ตัวอักษร'});if(!/^[a-f0-9]{32}$/.test(token))token=crypto.randomBytes(16).toString('hex');let key=crypto.createHash('sha256').update(token).digest('hex');let old=db[key];if(old){name=old.name;job=old.job;}let c=classes[job],p={id:s.id,key,name,job,x:clamp(old?.x||W/2,30,W-30),y:clamp(old?.y||H/2,30,H-30),level:old?.level||1,xp:old?.xp||0,gold:old?.gold??250,gems:old?.gems??200,stones:old?.stones??5,pity:old?.pity||0,inventory:Array.isArray(old?.inventory)?old.inventory.slice(0,100):[],weapon:old?.weapon||0,skin:old?.skin||'พื้นฐาน',hp:old?.hp||c.hp,maxHp:c.hp,lastMove:Date.now(),lastAttack:0,lastSkill:0,lastHeal:0};players.set(s.id,p);s.emit('welcome',{id:s.id,token,world:{w:W,h:H},...state(),stats:profile(p)});s.broadcast.emit('playerJoin',publicPlayer(p));cb?.({ok:true});});
 s.on('move',data=>{let p=players.get(s.id);if(!p)return;let now=Date.now(),dt=clamp((now-p.lastMove)/1000,0,.2);p.lastMove=now;let dx=Number(data?.dx),dy=Number(data?.dy);if(!Number.isFinite(dx)||!Number.isFinite(dy))return;let mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag;}p.x=clamp(p.x+dx*230*dt,25,W-25);p.y=clamp(p.y+dy*230*dt,25,H-25);io.emit('playerMove',{id:p.id,x:p.x,y:p.y});});
 function hit(skill){let p=players.get(s.id);if(!p)return;let now=Date.now(),cool=skill?2500:600,k=skill?'lastSkill':'lastAttack';if(now-p[k]<cool)return;p[k]=now;let radius=skill?150:85,damage=(classes[p.job].atk+p.level*2+p.weapon*4)*(skill?2:1),targets=[...mobs.values()].filter(m=>m.alive&&Math.hypot(m.x-p.x,m.y-p.y)<radius).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,skill?5:1);io.emit('attackFx',{id:p.id,x:p.x,y:p.y,skill});for(let m of targets){m.hp=Math.max(0,m.hp-damage);io.emit('mobHit',{id:m.id,hp:m.hp,damage,by:p.id});if(!m.hp){m.alive=false;m.respawn=Date.now()+12000;let t=mobTypes[m.type];p.xp+=t.xp;p.gold+=8+m.type*8;if(Math.random()<.25)p.stones++;while(p.xp>=p.level*65){p.xp-=p.level*65;p.level++;p.maxHp+=12;p.hp=p.maxHp;io.to(p.id).emit('notice','เลเวลอัป! '+p.level)}emitStats(p);}}}
 s.on('attack',()=>hit(false));s.on('skill',()=>hit(true));
 s.on('heal',()=>{let p=players.get(s.id);if(!p||Date.now()-p.lastHeal<3000||p.gold<25)return;p.lastHeal=Date.now();p.gold-=25;p.hp=Math.min(p.maxHp,p.hp+65);emitStats(p)});
 s.on('upgrade',()=>{let p=players.get(s.id);if(!p||p.weapon>=15)return;let cost=50+(p.weapon*35);if(p.gold<cost||p.stones<1)return s.emit('notice','เงินหรือหินไม่พอ');p.gold-=cost;p.stones--;p.weapon++;emitStats(p);s.emit('notice','ตีบวกสำเร็จ +'+p.weapon)});
 s.on('gacha',()=>{let p=players.get(s.id);if(!p||p.gems<50)return s.emit('notice','เพชรไม่พอ');p.gems-=50;p.pity++;let rare=p.pity>=20||Math.random()<.05;if(rare)p.pity=0;let item=(rare?'SSR ':'')+rewards[Math.floor(Math.random()*rewards.length)];p.inventory.push(item);if(p.inventory.length>100)p.inventory.shift();emitStats(p);s.emit('gachaResult',{item,rare})});
 s.on('equip',i=>{let p=players.get(s.id);if(!p||!Number.isInteger(i)||i<0||i>=p.inventory.length)return;p.skin=p.inventory[i];emitStats(p);io.emit('playerMove',{id:p.id,x:p.x,y:p.y,skin:p.skin})});
 s.on('chat',msg=>{let p=players.get(s.id);if(!p)return;let now=Date.now();if(now-(p.lastChat||0)<900)return;p.lastChat=now;let text=clean(String(msg||'').slice(0,120));if(text)io.emit('chat',{name:p.name,text})});
 s.on('disconnect',()=>{let p=players.get(s.id);if(!p)return;persist(p);players.delete(s.id);io.emit('playerLeave',s.id)});
});
setInterval(()=>{let now=Date.now();for(let m of mobs.values()){if(!m.alive&&now>=m.respawn){m.alive=true;m.hp=m.maxHp;io.emit('mobRespawn',publicMob(m));}}},1000);
process.on('SIGTERM',()=>{for(let p of players.values())persist(p);save();server.close(()=>process.exit(0))});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('AETHERIA ONLINE listening'));

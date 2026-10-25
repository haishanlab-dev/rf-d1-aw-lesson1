/* Shared lesson player (F6) for Lesson 1, Units 2-4 and Weather Review.
   Each lesson page defines its own data first (SCREENS, IMGS, AUD, PRE) and config
   (RF_UNIT, PART_LABELS, VOICE_PACK, AUD_US_BASE, DUR_US), then loads this file. */
const P=new URLSearchParams(location.search);
const QA=P.get('qa')==='1';
const RATE=QA?8:1, GAP=QA?120:1200, CDSTEP=QA?150:1000;
window.__log=[];
function log(e){window.__log.push(e);}
const stage=document.getElementById('stage'), view=document.getElementById('view'), au=document.getElementById('au');
function fit(){/* fluid layout — no fixed stage scale */}
addEventListener('resize',fit);addEventListener('fullscreenchange',fit);addEventListener('webkitfullscreenchange',fit);
['dragstart','selectstart','contextmenu','gesturestart'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
let session='A', paused=false, actx=null, runId=0, playIdx=0;
const $=id=>document.getElementById(id);

function setPauseIcon(isPaused){
  const b=$('pausebtn'); if(!b) return;
  let ico=b.querySelector('.ms');
  if(!ico){ ico=document.createElement('span'); ico.className='ms'; b.textContent=''; b.appendChild(ico); }
  ico.textContent=isPaused?'play_arrow':'pause';
  b.classList.toggle('is-paused', !!isPaused);
  b.setAttribute('aria-label', isPaused?'play':'pause');
}
function setPlaying(on){
  document.body.classList.toggle('playing', !!on);
  if(on){ $('pausebtn').style.display='grid'; } else { $('pausebtn').style.display='none'; }
}

$('sA').onclick=()=>{session='A';$('sA').classList.add('sel');$('sB').classList.remove('sel');};
$('sB').onclick=()=>{session='B';$('sB').classList.add('sel');$('sA').classList.remove('sel');};


function esc(t){return String(t??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function partFirst(part){return SCREENS.find(s=>s.part===part);}
function partLabel(p){return PART_LABELS[p]||('Part '+p);}
function prog(sc){let h='<div class="prog">';for(let p=1;p<=4;p++){h+='<button type="button" data-part="'+p+'" class="'+(p===sc.part?'on':(p<sc.part?'done':''))+'" aria-label="Go to part '+p+'">'+p+'</button>';}return h+'</div>';}
function bindNav(){
  document.querySelectorAll('.prog [data-part], .mapnav [data-part]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation(); jumpToPart(+el.getAttribute('data-part'));};
  });
}
function render(sc,state){ // state: 'show' | 'ask' | 'reveal'
  let img=(state==='reveal'&&sc.rimg)?sc.rimg:sc.img;
  let h='<div class="screen">'+prog(sc)+'<div class="titles"><div class="zh">'+esc(sc.zh)+'</div><div class="en">'+esc(sc.en)+'</div></div>';
  h+='<div class="content"><div class="imgbox"><img data-rfsrc="'+IMGS[img]+'" alt=""></div><div class="panel" id="panel">';
  if(sc.type==='pause'||sc.type==='retell'){
    if(state==='reveal'){
      h+='<div class="q qecho" style="border-color:#cfe3f3">'+sc.q.map(l=>'<div class="line">'+esc(l)+'</div>').join('')+'</div>';
      h+='<div class="rev">'+sc.reveal.map(l=>'<div class="line">'+esc(l)+'</div>').join('')+'</div>';
      if(sc.page) h+='<div class="pagehint">📖 Check book page '+sc.page+'</div>';
    } else {
      h+='<div class="q">'+sc.q.map(l=>'<div class="line">'+esc(l)+'</div>').join('')+'</div>';
      h+='<div class="cd" id="cd" style="visibility:hidden">5</div>';
    }
  } else {
    if(sc.map){
      h+='<div class="mapnav">';
      for(let p=1;p<=4;p++){h+='<button type="button" data-part="'+p+'"><span class="n">'+p+'</span>'+esc(partLabel(p))+'</button>';}
      h+='</div>';
    } else {
      h+=sc.body.map((l,k)=>'<div class="line'+(k===0&&sc.body.length<=3&&l.length<=10?' big':'')+'">'+esc(l)+'</div>').join('');
    }
  }
  h+='</div></div></div>';
  view.innerHTML=h;
  try{ if(window.RFDiagram) RFDiagram.apply(view, sc, state, RF_UNIT); }catch(_e){}
  try{ if(window.RFInteract) RFInteract.mount(view, sc, state, RF_UNIT); }catch(_e){}
  view.querySelectorAll('img[data-rfsrc]').forEach(im=>{im.src=im.getAttribute('data-rfsrc');im.removeAttribute('data-rfsrc');});
  if(sc.type==='normal'&&!sc.map&&(sc.body||[]).length<=2){const scr=view.querySelector('.screen');if(scr)scr.classList.add('stack');}
  bindNav();
}
function wait(ms,id){return new Promise(res=>{let left=ms;const t=setInterval(()=>{if(id!==runId){clearInterval(t);return;}if(!paused&&!(window.RFInteract&&RFInteract.holding())){left-=50;if(left<=0){clearInterval(t);res();}}},50);});}

function tick(){try{if(!actx)return;const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;o.type='sine';g.gain.setValueAtTime(0.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(0.18,actx.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.18);o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+0.2);}catch(e){}}
let holdResolve=null;
async function countdownN(id,nStart){
  const cd=$('cd'); if(!cd)return;
  cd.style.visibility='visible';
  for(let n=nStart;n>=1;n--){
    if(id!==runId)return;
    if(window.RFInteract&&RFInteract.resolved())break;
    cd.textContent=n; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
    tick(); log({ev:'cd',n}); await wait(CDSTEP,id);
  }
}
function waitForContinue(id, opts){
  return new Promise(res=>{
    if(QA){ setTimeout(()=>{ if(id===runId) res(); }, 80); return; }
    holdResolve=()=>{ holdResolve=null; try{ if(window.RFRetell&&RFRetell.stopIfRecording) RFRetell.stopIfRecording(); }catch(_e){} res(); };
    paused=true; setPauseIcon(true);
    const panel=$('panel');
    if(panel && !panel.querySelector('.contbtn')){
      const b=document.createElement('button'); b.className='contbtn'; b.innerHTML='<span class="ms" style="font-size:22px">play_arrow</span> Continue';
      b.onclick=()=>{ if(holdResolve){ paused=false; setPauseIcon(false); holdResolve(); } };
      panel.appendChild(b);
    }
    if(panel && opts && opts.retell && window.RFRetell){ try{ RFRetell.mount(panel, RF_UNIT); }catch(_e){} }
    log({ev:'hold'});
  });
}
function ensureAudio(){try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();actx.resume();}catch(e){}}
function activeVoice(){try{if(window.RFProgress&&RFProgress.getVoice)return RFProgress.getVoice();const v=(localStorage.getItem('rfVoice')||'en-GB').trim();return (v==='en-US'||v==='en-GB')?v:'en-GB';}catch(e){return 'en-GB';}}
function audioUrl(key){if(activeVoice()==='en-US')return AUD_US_BASE+key+'.mp3?v=vo2';return AUD[key];}
function audioSrc(key){const u=audioUrl(key);return (window.RFAssets&&u)?RFAssets.media(u):u;}
/* perf: per-screen media list (built by tools/build_preload_manifest.py) + look-ahead prefetch */
function rfPre(i,state){try{return (typeof PRE!=='undefined'&&PRE[i+'|'+state])||[];}catch(e){return [];}}
function rfStates(s){return (s.type==='pause'||s.type==='retell')?['ask','reveal']:['show'];}
function rfPrefetch(i,ahead){
  if(!window.RFAssets)return;
  const end=Math.min(SCREENS.length-1,i+(ahead==null?3:ahead));
  for(let j=end;j>=i;j--){const s=SCREENS[j];const k=String(s.i).padStart(2,'0');const now=j===i;
    rfStates(s).forEach(st=>rfPre(j,st).forEach(u=>RFAssets.queue('img',u,now)));
    if(rfStates(s).length>1)RFAssets.queue('media',audioUrl(k+'_rn'),now);
    RFAssets.queue('media',audioUrl(k+'_n'),now);}
}
function rfReady(i,state){return window.RFAssets?RFAssets.ready(rfPre(i,state),1500):Promise.resolve();}
/* Use the in-memory clip if it is (nearly) here; else stream the file as before. */
function rfClip(key,id){
  const u=audioUrl(key);
  if(!window.RFAssets||!u)return Promise.resolve(u);
  const b=RFAssets.media(u); if(b!==u)return Promise.resolve(b);
  return Promise.race([RFAssets.fetchMedia(u),new Promise(r=>setTimeout(r,2500))]).then(x=>x||u);
}
function audioFallback(key,fallbackSec){if(activeVoice()==='en-US'&&DUR_US[key]!=null)return DUR_US[key];return fallbackSec;}
function play(key,fallbackSec,id){return rfClip(key,id).then(src=>id!==runId?new Promise(()=>{}):playSrc(key,src,fallbackSec,id));}
function playSrc(key,src,fallbackSec,id){return new Promise(res=>{
  /* Wait until HAVE_FUTURE_DATA (rs>=3) + force currentTime=0 before play().
     Early canplay at rs=1 (e.g. leftover silent unlock WAV) must not start playback.
     Timeout recovers via timed wait — never plays at rs<3. */
  let done=false, kicked=false, readyTimer=0;
  const fin=(why)=>{if(done)return;done=true;clearTimeout(readyTimer);au.onended=null;au.onerror=null;au.onloadeddata=null;au.oncanplay=null;log({ev:'ended',key,why,voice:activeVoice()});res();};
  const fb=audioFallback(key,fallbackSec);
  au.onended=()=>fin('ended');
  au.onerror=()=>{log({ev:'audioerror',key,voice:activeVoice()});wait(fb*1000/RATE,id).then(()=>fin('fallback'));};
  let seeked=false;
  let want='';
  const kick=()=>{
    if(kicked||done||id!==runId)return;
    if(want&&au.src!==want)return; /* event from an older source (silent unlock / previous clip) */
    if(au.readyState<3)return; /* HAVE_FUTURE_DATA required — ignore stale early canplay */
    if(!seeked){
      seeked=true;
      au.onloadeddata=null; au.oncanplay=null;
      try{au.pause();}catch(e){}
      try{au.currentTime=0;}catch(e){}
      /* Chromium often demotes readyState after seek — wait again, never play at rs<3 */
      if(au.readyState<3){
        au.onloadeddata=()=>kick();
        au.oncanplay=()=>kick();
        return;
      }
    }
    kicked=true; clearTimeout(readyTimer);
    au.onloadeddata=null; au.oncanplay=null;
    au.playbackRate=RATE;au.defaultPlaybackRate=RATE;
    const rsAtPlay=au.readyState;
    const pr=au.play();
    if(pr&&pr.catch)pr.catch(err=>{log({ev:'playreject',key,msg:String(err)});wait(fb*1000/RATE,id).then(()=>fin('fallback'));});
    log({ev:'play',key,voice:activeVoice(),ct:+au.currentTime.toFixed(3),rs:rsAtPlay});
  };
  au.onloadeddata=()=>kick();
  au.oncanplay=()=>kick();
  au.src=src; want=au.src;
  try{au.load();}catch(e){}
  if(au.readyState>=3) kick();
  else{
    /* Soft check at 1.2 s (slow network): keep waiting for canplay — never play at rs<3.
       Hard stop at 12 s: give up on this clip and continue on the timed fallback. */
    readyTimer=setTimeout(()=>{
      if(kicked||done||id!==runId)return;
      if(au.readyState>=3){ kick(); return; }
      log({ev:'playslow',key,rs:au.readyState,voice:activeVoice()});
      readyTimer=setTimeout(()=>{
        if(kicked||done||id!==runId)return;
        if(au.readyState>=3){ kick(); return; }
        kicked=true; au.onloadeddata=null; au.oncanplay=null;
        log({ev:'playtimeout',key,rs:au.readyState,voice:activeVoice()});
        wait(fb*1000/RATE,id).then(()=>fin('timeout'));
      },10800);
    },1200);
  }
});}
function unlockAudioFor(sc){
  /* Unlock HTMLAudioElement inside the Start gesture without priming the lesson
     clip. The old play-then-pause on the real MP3 left currentTime past the
     opening silence, so the first play() resumed mid-word. */
  try{
    const silent='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    au.src=silent;
    const pr=au.play();
    const stop=()=>{try{au.pause();au.currentTime=0;}catch(e){}};
    if(pr&&pr.then) pr.then(stop,stop); else stop();
  }catch(e){}
}

function isFs(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function syncFsChrome(){document.body.classList.toggle('fs', isFs());}
function tryFullscreen(){try{const fsEl=document.getElementById('wrap')||document.documentElement;const req=fsEl.requestFullscreen||fsEl.webkitRequestFullscreen;if(req){const p=req.call(fsEl);if(p&&p.catch)p.catch(function(){});}}catch(e){} syncFsChrome();}
addEventListener('fullscreenchange',syncFsChrome);addEventListener('webkitfullscreenchange',syncFsChrome);syncFsChrome();
async function runFromIndex(startIdx){
  const id=++runId; paused=false; setPauseIcon(false); holdResolve=null;
  try{ if(window.RFRetell&&RFRetell.discard) RFRetell.discard(); }catch(_e){}
  const start=SCREENS[startIdx]; if(!start)return;
  session=start.s;
  for(let i=startIdx;i<SCREENS.length;i++){
    playIdx=i;
    const sc=SCREENS[i];
    if(sc.s!==start.s) break;
    if(id!==runId)return;
    const k=String(sc.i).padStart(2,'0');
    log({ev:'screen',i:sc.i,part:sc.part,type:sc.type});
    try{ if(window.RFProgress&&RFProgress.notePart) RFProgress.notePart(RF_UNIT, sc.part); }catch(_e){}
    rfPrefetch(i);
    if(sc.type==='pause'){
      await rfReady(i,'ask');if(id!==runId)return;render(sc,'ask');await play(k+'_n',sc.dn,id);if(id!==runId)return;
      try{ if(window.RFInteract) RFInteract.begin(id); }catch(_e){}
      await wait(400/ (QA?4:1),id);await countdownN(id,5);if(id!==runId)return;
      try{ if(window.RFInteract) await RFInteract.settle(id); }catch(_e){}
      if(id!==runId)return;
      await rfReady(i,'reveal');if(id!==runId)return;render(sc,'reveal');log({ev:'reveal',i:sc.i});await play(k+'_rn',sc.dr,id);
    } else if(sc.type==='retell'){
      await rfReady(i,'ask');if(id!==runId)return;render(sc,'ask');await play(k+'_n',sc.dn,id);if(id!==runId)return;
      try{ if(window.RFRetell) RFRetell.mount($('panel'), RF_UNIT); }catch(_e){}
      // No 3-2-1 / timed countdown: Miles taps Record to start immediately, then Continue when done.
      await waitForContinue(id, {retell:true}); if(id!==runId)return;
      try{ if(window.RFRetell&&RFRetell.stopIfRecording) await RFRetell.stopIfRecording(); }catch(_e){}
      if(id!==runId)return;
      await rfReady(i,'reveal');if(id!==runId)return;render(sc,'reveal');log({ev:'reveal',i:sc.i});
      try{ if(window.RFRetell) RFRetell.mount($('panel'), RF_UNIT); }catch(_e){}
      await play(k+'_rn',sc.dr,id);if(id!==runId)return;
      await waitForContinue(id, {retell:true}); if(id!==runId)return;
      try{ if(window.RFProgress&&RFProgress.noteRetell) RFProgress.noteRetell(RF_UNIT); }catch(_e){}
    } else {await rfReady(i,'show');if(id!==runId)return;render(sc,'show');await play(k+'_n',sc.dn,id);}
    if(id!==runId)return;await wait(GAP,id);
  }
  if(id!==runId)return;
  log({ev:'sessionend',sess:start.s}); try{if(window.RFProgress&&RFProgress.markSessionDone)RFProgress.markSessionDone(RF_UNIT, start.s); else if(window.RFProgress)RFProgress.markComplete(RF_UNIT);}catch(_e){}
  const p=$('panel');
  if(p){
    const nx=SCREENS.find(s=>s.s!==start.s&&s.i>startIdx);
    const isFinal=!nx || (SCREENS[SCREENS.length-1]&&SCREENS[SCREENS.length-1].zh==='Great job!'&&start.s===SCREENS[SCREENS.length-1].s);
    const restart=()=>{runId++;au.pause();holdResolve=null;setPlaying(false);$('start').style.display='flex';};
    if(window.RFEndActions){
      RFEndActions.mount(p,{
        unit:RF_UNIT,
        isFinal:isFinal,
        onRestart:restart,
        onSession2:nx?()=>{runId++;au.pause();holdResolve=null;jumpToPart(nx.part);}:undefined
      });
    }else{
      const row=document.createElement('div');row.className='endrow';
      const b=document.createElement('button');b.className='endbtn';b.textContent='重新开始';b.onclick=restart;row.appendChild(b);
      if(nx){const n=document.createElement('button');n.className='endbtn endnext';n.textContent='Session 2';n.onclick=()=>{runId++;au.pause();holdResolve=null;jumpToPart(nx.part);};row.appendChild(n);}
      p.appendChild(row);
    }
  }
}
function jumpToPart(part){
  const sc=partFirst(part); if(!sc) return;
  playIdx=sc.i;
  ensureAudio(); unlockAudioFor(sc); tryFullscreen();
  $('start').style.display='none'; setPlaying(true); setPauseIcon(false);
  log({ev:'jump',part});
  runFromIndex(sc.i);
}
async function runSession(sess){
  const first=SCREENS.find(s=>s.s===sess); if(!first)return;
  await runFromIndex(first.i);
}

/* Desktop-only keyboard skip (never iPad / iPhone — incl. iPadOS desktop-UA + Bluetooth keyboard) */
function rfIsIPadLike(){
  const ua=navigator.userAgent||'';
  if(/iPad|iPhone|iPod/.test(ua)) return true;
  if(navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1) return true;
  return false;
}
function rfSkipScreen(delta){
  if(rfIsIPadLike()) return;
  if(!document.body.classList.contains('playing')) return;
  if($('start') && $('start').style.display!=='none' && !document.body.classList.contains('playing')) return;
  const next=Math.max(0, Math.min(SCREENS.length-1, playIdx+delta));
  if(next===playIdx && (next===0 || next===SCREENS.length-1)) return;
  runId++;
  try{ au.pause(); }catch(e){}
  holdResolve=null; paused=false; setPauseIcon(false);
  try{ if(window.RFInteract&&RFInteract.cancel) RFInteract.cancel(); }catch(e){}
  try{ if(window.RFRetell&&RFRetell.stopIfRecording) RFRetell.stopIfRecording(); }catch(e){}
  try{ if(window.RFReading&&RFReading.stop) RFReading.stop(); }catch(e){}
  playIdx=next;
  runFromIndex(next);
}
if(!rfIsIPadLike()){
  window.addEventListener('keydown', (e)=>{
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const t=e.target; if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return;
    if(e.key==='ArrowRight'||e.key==='j'||e.key==='J'||e.key==='.'){ e.preventDefault(); rfSkipScreen(1); }
    else if(e.key==='ArrowLeft'||e.key==='k'||e.key==='K'||e.key===','){ e.preventDefault(); rfSkipScreen(-1); }
  }, true);
}

$('go').onclick=()=>{
  ensureAudio();
  const first=SCREENS.find(s=>s.s===session); unlockAudioFor(first); tryFullscreen();
  $('start').style.display='none'; setPlaying(true); setPauseIcon(false); paused=false;
  runSession(session);
};
$('pausebtn').onclick=()=>{
  if(holdResolve){ tryFullscreen(); paused=false; setPauseIcon(false); holdResolve(); return; }
  paused=!paused;setPauseIcon(paused);
  if(paused){ au.pause(); }
  else {
    tryFullscreen();
    if(au.src&&!au.ended){const pr=au.play();if(pr&&pr.catch)pr.catch(()=>{});}
  }
};

function openToc(){$('toc').classList.add('open');$('tocmask').classList.add('open');}
function closeToc(){$('toc').classList.remove('open');$('tocmask').classList.remove('open');}
$('tocbtn').onclick=(e)=>{e.stopPropagation(); openToc();};
const chip=$('coursechip');
if(chip){ chip.onclick=(e)=>{e.stopPropagation(); openToc(); chip.setAttribute('aria-expanded','true');}; }
const _openToc=openToc, _closeToc=closeToc;
openToc=function(){ _openToc(); if(chip) chip.setAttribute('aria-expanded','true'); };
closeToc=function(){ _closeToc(); if(chip) chip.setAttribute('aria-expanded','false'); };

$('tocx').onclick=(e)=>{e.stopPropagation(); closeToc();};
$('tocmask').onclick=()=>closeToc();
// URL: ?s=B selects Session 2; ?part=3 jumps after start gesture still needed — part on start selects session
if(P.get('s')==='B'||P.get('session')==='B'){session='B';$('sB').classList.add('sel');$('sA').classList.remove('sel');}
if(P.get('s')==='A'||P.get('session')==='A'){session='A';$('sA').classList.add('sel');$('sB').classList.remove('sel');}
const wantPart=+P.get('part');
if(wantPart>=1&&wantPart<=4){const sc=partFirst(wantPart); if(sc){session=sc.s; if(session==='B'){$('sB').classList.add('sel');$('sA').classList.remove('sel');} else {$('sA').classList.add('sel');$('sB').classList.remove('sel');}}}
// static frame mode for export/QA: ?frame=N&state=show|ask|reveal
if(P.has('frame')){$('start').style.display='none';setPlaying(true);setPauseIcon(false);const sc=SCREENS[+P.get('frame')];playIdx=sc.i;const st=P.get('state')||(sc.type==='pause'||sc.type==='retell'?'reveal':'show');render(sc,st);if(st==='ask'){const cd=$('cd');cd.style.visibility='visible';cd.textContent='3';}}
setPauseIcon(false); // init
/* perf: fetch the chosen session's first picture + clip right away (not after load), so Start → first words is not stuck behind them */
try{if(window.RFAssets&&!P.has('frame')){const s0=SCREENS.find(x=>x.s===session);if(s0)rfPrefetch(s0.i,0);}}catch(_e){}
addEventListener('load',()=>{if(!window.RFAssets)return;RFAssets.idle(()=>{
  const firsts=[0];for(let p=1;p<=4;p++){const f=partFirst(p);if(f&&firsts.indexOf(f.i)<0)firsts.push(f.i);}
  const sel=SCREENS.find(x=>x.s===session); if(sel&&firsts.indexOf(sel.i)<0)firsts.unshift(sel.i);
  firsts.forEach(i=>rfPrefetch(i,0)); if(sel)rfPrefetch(sel.i,2); RFAssets.warmNoto();
});});

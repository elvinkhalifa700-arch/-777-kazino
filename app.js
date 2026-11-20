const $ = (id) => document.getElementById(id);
let balance = 0, bet = 5, busy = false, soundOn = true, audioCtx = null;
const symbols = ["cherry","lemon","grapes","watermelon","orange","bell","diamond","seven"];
const labels = {cherry:"Albalı",lemon:"Limon",grapes:"Üzüm",watermelon:"Qarpız",orange:"Portağal",bell:"Zəng",diamond:"Brilyant",seven:"7"};
function sound(freq=440,duration=.12,type="sine",volume=.045){
  if(!soundOn) return;
  try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=volume;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.stop(audioCtx.currentTime+duration); } catch(e){}
}
function setBalance(n){balance=n;$("balance").textContent=Number(n).toFixed(2)}
function amountToDisplay(n){return Number(n).toFixed(2)}
function symbolMarkup(name){
  if(name==="seven") return '<div class="symbol seven" data-symbol="seven">7</div>';
  return `<div class="symbol" data-symbol="${name}"><img src="/symbols/${name}.svg" alt="${labels[name]}"></div>`;
}
function renderGrid(grid){
  $("reels").innerHTML=grid.map((col,ci)=>`<div class="reel-col">${col.map(s=>symbolMarkup(s)).join("")}</div>`).join("")+'<div class="payline"><span>777</span></div>';
}
async function loadMe(){
  const r=await fetch("/api/me"); const d=await r.json(); setBalance(d.balance||0); loadHistory();
}
async function loadHistory(){
  const r=await fetch("/api/history"); if(!r.ok)return; const rows=await r.json();
  $("historyList").innerHTML=rows.length?rows.map(x=>`<div class="history-row"><span>Mərc ${amountToDisplay(x.bet)} AZN</span><b class="${x.win>0?"positive":"negative"}">${x.win>0?"+"+amountToDisplay(x.win):"−"+amountToDisplay(x.bet)} AZN</b></div>`).join(""):'<p class="muted">Hələ oyun yoxdur.</p>';
}
document.querySelectorAll("[data-bet]").forEach(btn=>btn.addEventListener("click",()=>{if(busy)return;bet=Number(btn.dataset.bet);document.querySelectorAll("[data-bet]").forEach(b=>b.classList.toggle("selected",b===btn));sound(520,.07)}));
$("spinBtn").addEventListener("click",async()=>{
  if(busy)return;
  if(balance<bet){$("result").textContent="BALANS KİFAYƏT ETMİR — DEMO KOD DAXİL ET";sound(180,.2,"sawtooth");return}
  busy=true;$("spinBtn").disabled=true;$("result").classList.remove("win");$("result").textContent="FIRLANIR...";$("reels").classList.add("spinning");sound(170,.5,"sawtooth",.025);
  try{
    const r=await fetch("/api/spin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bet})});const d=await r.json();
    if(!r.ok)throw new Error(d.error||"Xəta baş verdi");
    await new Promise(resolve=>setTimeout(resolve,950));
    renderGrid(d.grid);setBalance(d.balance);$("reels").classList.remove("spinning");
    if(d.win>0){$("result").textContent=`🎉 TƏBRİKLƏR! +${amountToDisplay(d.win)} AZN`; $("result").classList.add("win");document.querySelectorAll(".reel-col:nth-child(-n+3) .symbol:nth-child(2)").forEach(x=>x.classList.add("winner"));sound(660,.14);setTimeout(()=>sound(880,.2),140);setTimeout(()=>sound(1100,.28),280)}
    else{$("result").textContent="BU DƏFƏ UDUŞ YOXDUR — YENİDƏN SINA";sound(260,.12,"triangle")}
    loadHistory();
  }catch(e){$("result").textContent=e.message;$("reels").classList.remove("spinning")}
  finally{busy=false;$("spinBtn").disabled=false}
});
$("openCode").addEventListener("click",()=>{$("codeModal").classList.remove("hidden");$("codeInput").focus()});
$("closeCode").addEventListener("click",()=> $("codeModal").classList.add("hidden"));
$("codeModal").addEventListener("click",e=>{if(e.target===$("codeModal"))$("codeModal").classList.add("hidden")});
$("redeemForm").addEventListener("submit",async e=>{
  e.preventDefault();const code=$("codeInput").value.trim();$("codeMessage").textContent="Yoxlanılır...";
  try{const r=await fetch("/api/redeem",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});const d=await r.json();if(!r.ok)throw new Error(d.error);setBalance(d.balance);$("codeMessage").textContent=d.message;sound(740,.18);$("codeInput").value="";loadHistory()}catch(err){$("codeMessage").textContent=err.message;sound(180,.2,"sawtooth")}
});
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"♫ SƏS AÇIQ":"♪ SƏS BAĞLI";if(soundOn)sound(600,.1)});
renderGrid([["cherry","lemon","grapes"],["watermelon","seven","bell"],["orange","diamond","cherry"]]);
loadMe();

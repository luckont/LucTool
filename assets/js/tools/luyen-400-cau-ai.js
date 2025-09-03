// ===== Helpers =====
function el(tag, opts={}, text=''){
  const d = document.createElement(tag);
  if (opts.className) d.className = opts.className;
  if (opts.attrs) for (const [k,v] of Object.entries(opts.attrs)) d.setAttribute(k,v);
  if (text) d.textContent = text;
  return d;
}
function clear(n){ while(n.firstChild) n.removeChild(n.firstChild); }

// CSV parser (có hỗ trợ field có dấu ")
function parseCSV(text){
  const rows=[]; let f='', r=[], q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c=='"'){ if(q&&n=='"'){ f+='"'; i++; } else q=!q; }
    else if(c==',' && !q){ r.push(f); f=''; }
    else if((c=='\n'||c=='\r') && !q){ if(f.length||r.length){ r.push(f); rows.push(r); r=[]; f=''; } if(c=='\r'&&n=='\n') i++; }
    else f+=c;
  }
  if(f.length||r.length){ r.push(f); rows.push(r); }
  return rows;
}

// Giữ lại chỉ các đáp án có nội dung; map lại chỉ số đúng
function mapRows(rows){
  const data = rows.filter(r => r.some(c => c && String(c).trim().length));
  if (!data.length) return [];
  const start = /question|câu hỏi/i.test((data[0][0]||'')) ? 1 : 0;
  const out = [];
  for (let i=start;i<data.length;i++){
    const [q,A,B,C,D,correctRaw,explain] = (data[i]||[]).map(x=>(x||'').trim());
    if(!q) continue;
    const raw=[A,B,C,D];
    const opts=[];
    for(let j=0;j<raw.length;j++){
      const t=raw[j];
      if(!t || /^[-–—]$/.test(t)) continue;   // bỏ trống hoặc gạch
      opts.push({ text:t, orig:j });
    }
    if(!opts.length) continue;
    let correctOrig = 'ABCD'.indexOf((correctRaw||'').toUpperCase());
    if(correctOrig<0 && /^[1-4]$/.test(correctRaw)) correctOrig = parseInt(correctRaw,10)-1;
    let correct = opts.findIndex(o=>o.orig===correctOrig);
    if(correct<0) correct=0;
    out.push({ q, opts, correct, explain: explain||'' });
  }
  return out;
}

// ===== State & Elements =====
const state = {
  allQs: [], qs: [], idx: 0, ans: [], revealed: [], submitted:false,
  timer:null, timeLeft:1800
};

const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const sampleBtn = document.getElementById('sampleBtn');
const startBtn = document.getElementById('startBtn');
const qCountSel = document.getElementById('questionCount');
const timeSel = document.getElementById('timeLimit');
const randomCk = document.getElementById('randomOrder');
const quizSec = document.getElementById('quizSection');

// Khóa Bắt đầu cho đến khi nạp file
startBtn.disabled = true;

// ===== Upload flow =====
chooseFileBtn.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', async ()=>{
  const f=fileInput.files?.[0]; if(!f) return;
  const text = await f.text();
  loadFromCSV(text);
});
sampleBtn.addEventListener('click', ()=>{
  const text = `question,optionA,optionB,optionC,optionD,correct,explanation
Câu 1: Thủ đô Việt Nam?,Hà Nội,TP.HCM,Đà Nẵng,Huế,A,Hà Nội là thủ đô.
Câu 2: 2+2=?,3,4,5,6,2,Số 4.`;
  loadFromCSV(text);
});

function loadFromCSV(text){
  const rows = parseCSV(text);
  state.allQs = mapRows(rows);
  document.getElementById('totalAvailable').textContent = `(Có ${state.allQs.length} câu trong file)`;
  startBtn.disabled = state.allQs.length === 0;
}

// ===== Quiz flow =====
startBtn.addEventListener('click', startWithSettings);
document.getElementById('prevBtn').addEventListener('click', ()=>{ if(state.idx>0){ state.idx--; renderQ(); } });
document.getElementById('nextBtn').addEventListener('click', ()=>{ if(state.idx<state.qs.length-1){ state.idx++; renderQ(); } });
document.getElementById('submitBtn').addEventListener('click', submit);

function startWithSettings(){
  if(!state.allQs.length){ alert('Hãy tải CSV trước.'); return; }
  const val = qCountSel.value;
  let count = val==='all' ? state.allQs.length : Math.min(parseInt(val,10), state.allQs.length);
  state.qs = state.allQs.slice();
  if(randomCk.checked){
    for(let i=state.qs.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [state.qs[i], state.qs[j]] = [state.qs[j], state.qs[i]]; }
  }
  state.qs = state.qs.slice(0, count);
  state.idx = 0;
  state.ans = Array(state.qs.length).fill(null);
  state.revealed = Array(state.qs.length).fill(false);
  state.submitted = false;
  state.timeLeft = parseInt(timeSel.value, 10);
  document.getElementById('totalQuestions').textContent = state.qs.length;
  document.getElementById('currentScore').textContent = '0';
  createStatusGrid();
  startTimer();
  quizSec.classList.remove('hidden');
  renderQ();
}

function createStatusGrid(){
  const g = document.getElementById('statusGrid'); g.innerHTML='';
  for(let i=0;i<state.qs.length;i++){
    const d = el('div',{className:'status-item unanswered', attrs:{id:'status-'+i}}, String(i+1));
    d.onclick = ()=>{ state.idx=i; renderQ(); };
    g.appendChild(d);
  }
  updateStatusGrid();
}
function updateStatusGrid(){
  for(let i=0;i<state.qs.length;i++){
    const d = document.getElementById('status-'+i);

    if (i === state.idx){
      d.className = 'status-item current';
    } else if (state.ans[i] == null){
      d.className = 'status-item unanswered';
    } else {
      if (state.qs[i].correct === state.ans[i]){
        d.className = 'status-item answered-correct';
      } else {
        d.className = 'status-item answered-incorrect';
      }
    }
  }
}


function startTimer(){
  updateTimerDisplay();
  clearInterval(state.timer);
  state.timer = setInterval(()=>{
    state.timeLeft--;
    updateTimerDisplay();
    if(state.timeLeft<=0){ clearInterval(state.timer); submit(); }
  },1000);
}
function updateTimerDisplay(){
  const m = Math.floor(state.timeLeft/60), s = state.timeLeft%60;
  document.getElementById('timer').textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

// Render 2–4 đáp án tùy CSV; khóa câu sau khi chọn; hiện đúng/sai ngay
function renderQ(){
  const q = state.qs[state.idx]; if(!q) return;
  document.getElementById('questionText').textContent = q.q;
  document.getElementById('currentQuestion').textContent = state.idx+1;
  document.getElementById('progressBar').style.width = ((state.idx)/Math.max(1,state.qs.length)*100)+'%';

  const wrap = document.getElementById('optionsContainer'); clear(wrap);
  const revealedNow = state.revealed[state.idx];

  q.opts.forEach((opt,i)=>{
    const label = el('label',{className:'option ' + (
      revealedNow
        ? (i===q.correct ? 'correct' : (state.ans[state.idx]===i ? 'incorrect' : ''))
        : (state.ans[state.idx]===i ? 'selected' : '')
    )});
    const input = el('input', {attrs:{type:'radio', name:'q-'+state.idx, value:String(i)}});
    input.checked = state.ans[state.idx]===i;
    input.disabled = state.submitted || revealedNow;
    input.addEventListener('change', ()=>{
      if(state.submitted || state.revealed[state.idx]) return;
      state.ans[state.idx]=i;
      state.revealed[state.idx]=true;  // chỉ chọn 1 lần
      renderQ();
      updateStatusGrid();
    });
    const oletter = el('div',{className:'option-letter'}, 'ABCD'[i]||String(i+1));
    const span    = el('div',{className:'option-text'}, opt.text);
    label.appendChild(input); label.appendChild(oletter); label.appendChild(span);
    wrap.appendChild(label);
  });

  // đảm bảo mỗi câu “vừa khung nhìn”
  const qa = document.querySelector('.question-area');
  if (qa) qa.scrollTo({ top: 0, behavior: 'instant' });

  updateStatusGrid();
}

// ===== Modal kết quả =====
const modal      = document.getElementById('resultModal');
const closeBtn   = document.getElementById('resultCloseBtn');
const mFinal     = document.getElementById('m_finalScore');
const mCorrect   = document.getElementById('m_correctAnswers');
const mAcc       = document.getElementById('m_accuracy');
const mReviewBtn = document.getElementById('m_reviewBtn');
const mRestartBtn= document.getElementById('m_restartBtn');

function openResultModal({score, total, accPct}){
  mFinal.textContent   = String(score);
  mCorrect.textContent = String(score);
  mAcc.textContent     = accPct + '%';
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  const dlg = modal.querySelector('.modal-dialog'); dlg && dlg.focus();
}
function closeResultModal(){ modal.classList.add('hidden'); document.body.classList.remove('modal-open'); }

modal?.addEventListener('click', (e)=>{ if (e.target.dataset.close) closeResultModal(); });
closeBtn?.addEventListener('click', closeResultModal);
document.addEventListener('keydown', (e)=>{ if (!modal.classList.contains('hidden') && e.key==='Escape') closeResultModal(); });
mReviewBtn?.addEventListener('click', closeResultModal);
mRestartBtn?.addEventListener('click', ()=>{
  // Reset lại state nhưng giữ nguyên state.allQs
  if (!state.allQs.length){
    alert("Chưa có dữ liệu CSV, hãy tải file trước.");
    return;
  }
  closeResultModal();
  startWithSettings();
});


function submit(){
  state.submitted = true; clearInterval(state.timer);
  let score = 0; state.qs.forEach((q,i)=>{ if(state.ans[i]===q.correct) score++; });
  document.getElementById('currentScore').textContent = String(score);
  const acc = Math.round(score/state.qs.length*100);
  document.getElementById('progressBar').style.width = '100%';
  openResultModal({ score, total: state.qs.length, accPct: acc });
}

// ===== Toggle trạng thái (mobile) =====
const toggleBtn = document.getElementById('toggleStatus');
const statusWrap = document.getElementById('statusGridWrap');
if (toggleBtn && statusWrap) {
  let opened = false;
  const setMax = (open) => {
    statusWrap.style.maxHeight = open ? (statusWrap.scrollHeight + 'px') : '0px';
    toggleBtn.textContent = open ? 'Ẩn' : 'Hiện';
  };
  toggleBtn.addEventListener('click', () => { opened = !opened; setMax(opened); });
  setMax(false);
}

// ===== Theme toggle =====
(() => {
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');

  // chọn theme khởi động: localStorage > system
  const saved = localStorage.getItem('theme');
  const systemPrefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = saved || (systemPrefersLight ? 'light' : 'dark');

  setTheme(initial);

  btn?.addEventListener('click', () => {
    const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
    setTheme(next);
  });

  function setTheme(mode){
    root.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
    if (btn){
      btn.setAttribute('aria-pressed', String(mode === 'light'));
      btn.querySelector('.icon').textContent = (mode === 'light') ? '☀️' : '🌙';
    }
  }
})();

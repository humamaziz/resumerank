/* ═══════════════════════════════════════════════════
   ResumeRank v5 — script.js
   Universal taxonomy · Builder · PDF reports · Counter
═══════════════════════════════════════════════════ */

const API = "https://resumerank-w8h2.onrender.com/analyze";
const $ = id => document.getElementById(id);

// ── State ────────────────────────────────────────────
let selectedCat  = "";
let selectedRole = "";
let selectedFile = null;
let lastResult   = null;
let currentTab   = 0;
const TABS       = 5;
let taxonomy     = {};

// Tips slider
let tipIdx = 0;
const TIPS = 7;
let tipTimer = null;

// Builder
let builderUnlocked = false;
let selectedTemplate = "minimal";
let includeAiSkills  = true;

// ── Init ─────────────────────────────────────────────
(async function init() {
  applyTheme(localStorage.getItem("rr-theme") || "dark");
  initNav();
  initAOS();
  initSmoothScroll();
  initTips();
  showRecentBanner();
  await loadTaxonomy();
  await fetchCounter();
})();

// ═══════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("rr-theme", t);
}
$("themeBtn").addEventListener("click", () =>
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark")
);

// ═══════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════
function initNav() {
  const nav  = $("nav");
  const ham  = $("hamburger");
  const menu = $("mobMenu");
  window.addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), {passive:true});
  ham.addEventListener("click", () => menu.classList.toggle("open"));
  document.addEventListener("click", e => { if (!nav.contains(e.target)) menu.classList.remove("open"); });
  document.querySelectorAll(".mm-link, .mob-menu .btn-cta").forEach(el =>
    el.addEventListener("click", () => menu.classList.remove("open"))
  );
}

// ═══════════════════════════════════════════════════
//  SMOOTH SCROLL
// ═══════════════════════════════════════════════════
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const t = document.querySelector(a.getAttribute("href"));
      if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 66, behavior: "smooth" }); }
    });
  });
}

// ═══════════════════════════════════════════════════
//  SCROLL REVEAL (AOS)
// ═══════════════════════════════════════════════════
function initAOS() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("aosIn"); io.unobserve(e.target); }
    });
  }, {threshold:0.08});
  document.querySelectorAll("[data-aos]").forEach(el => io.observe(el));
}

// ═══════════════════════════════════════════════════
//  LOAD TAXONOMY FROM BACKEND
// ═══════════════════════════════════════════════════
async function loadTaxonomy() {
  try {
    const res = await fetch(`${API}/api/taxonomy`);
    taxonomy = await res.json();
  } catch {
    // Fallback: minimal taxonomy if server unreachable
    taxonomy = {
      technology:{label:"Technology",roles:{software_dev:"Software Developer",frontend:"Frontend Developer",backend:"Backend Developer",fullstack:"Full Stack Developer",data_science:"Data Scientist",devops:"DevOps Engineer"}},
      management:{label:"Management",roles:{hr_manager:"HR Manager",project_manager:"Project Manager",product_manager:"Product Manager",business_analyst:"Business Analyst"}},
      marketing:{label:"Marketing",roles:{digital_marketing:"Digital Marketer",seo_specialist:"SEO Specialist",content_writer:"Content Writer",brand_manager:"Brand Manager"}},
      finance:{label:"Finance",roles:{accountant:"Accountant",financial_analyst:"Financial Analyst",investment_analyst:"Investment Analyst",ca:"Chartered Accountant"}},
      teaching:{label:"Teaching",roles:{school_teacher:"School Teacher",professor:"Professor",lecturer:"Lecturer",tutor:"Private Tutor"}},
      healthcare:{label:"Healthcare",roles:{doctor:"Doctor",nurse:"Nurse",pharmacist:"Pharmacist",lab_technician:"Lab Technician"}},
      law:{label:"Law",roles:{lawyer:"Lawyer",legal_analyst:"Legal Analyst",compliance_officer:"Compliance Officer"}},
      design:{label:"Design",roles:{ui_ux:"UI/UX Designer",graphic_designer:"Graphic Designer",product_designer:"Product Designer"}},
      research:{label:"Research",roles:{research_scientist:"Research Scientist",phd_candidate:"PhD Candidate",data_analyst:"Data Analyst"}},
      others:{label:"Others",roles:{civil_engineer:"Civil Engineer",journalist:"Journalist",event_manager:"Event Manager"}},
    };
  }
  renderCategories();
}

function renderCategories() {
  const grid = $("catGrid");
  grid.innerHTML = "";
  for (const [key, cat] of Object.entries(taxonomy)) {
    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.textContent = cat.label;
    btn.type = "button";
    btn.dataset.cat = key;
    btn.addEventListener("click", () => selectCategory(key, btn));
    grid.appendChild(btn);
  }
}

function selectCategory(catKey, btn) {
  selectedCat  = catKey;
  selectedRole = "";
  // Highlight selected category
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  // Show role row
  renderRoles(catKey);
  $("roleRow").style.display = "flex";
  $("uploadRow").style.display = "none";
  $("analyzeBtn").disabled = true;
}

function renderRoles(catKey) {
  const chips = $("roleChips");
  chips.innerHTML = "";
  const roles = taxonomy[catKey]?.roles || {};
  for (const [key, label] of Object.entries(roles)) {
    const chip = document.createElement("button");
    chip.className = "role-chip";
    chip.textContent = label;
    chip.type = "button";
    chip.dataset.role = key;
    chip.addEventListener("click", () => selectRole(key, chip));
    chips.appendChild(chip);
  }
}

function selectRole(roleKey, chip) {
  selectedRole = roleKey;
  document.querySelectorAll(".role-chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  $("uploadRow").style.display = "flex";
  // Re-evaluate analyze button
  if (selectedFile) $("analyzeBtn").disabled = false;
}

// ═══════════════════════════════════════════════════
//  FILE UPLOAD
// ═══════════════════════════════════════════════════
const browseBtn = $("browseBtn");
const dropZone  = $("dropZone");
const fileInput = $("fileInput");

browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over"); });
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (file.type !== "application/pdf") { toast("PDF files only.", "err"); return; }
  if (file.size > 5*1024*1024) { toast("Max 5 MB.", "err"); return; }
  selectedFile = file;
  $("fbName").textContent = file.name;
  $("fbSize").textContent  = fmtBytes(file.size);
  $("fileBar").style.display = "flex";
  $("dropZone").style.display = "none";
  if (selectedRole) $("analyzeBtn").disabled = false;
}

$("fbRm").addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  $("fileBar").style.display = "none";
  $("dropZone").style.display = "block";
  $("analyzeBtn").disabled = true;
});

// ═══════════════════════════════════════════════════
//  ANALYZE
// ═══════════════════════════════════════════════════
$("analyzeBtn").addEventListener("click", () => {
  if (!selectedRole) { toast("Please select a job category and role first.", "err"); return; }
  if (!selectedFile) { toast("Please upload a PDF resume.", "err"); return; }
  startAnalysis();
});

async function startAnalysis() {
  show("loadingCard");
  hide("uploadCard","resultsShell","errorCard");

  const steps   = ["ls1","ls2","ls3","ls4","ls5"];
  const msgs    = ["Parsing resume…","Scanning skills…","Matching keywords…","AI generating feedback…","Building report…"];
  const targets = [18, 38, 58, 80, 100];
  const pctEl   = $("ldPct");
  const fillEl  = $("progFill");
  const msgEl   = $("ldMsg");
  steps.forEach(id => $(id).classList.remove("done"));
  let si = 0;
  const timer = setInterval(() => {
    if (si >= steps.length) { clearInterval(timer); return; }
    $(steps[si]).classList.add("done");
    msgEl.textContent = msgs[si];
    animProg(targets[si], pctEl, fillEl);
    si++;
  }, 700);

  const fd = new FormData();
  fd.append("resume", selectedFile);
  fd.append("role", selectedRole);

  try {
    const res = await fetch(`${API}/api/analyze`, {method:"POST", body:fd});
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `Error ${res.status}`);
    const data = await res.json();
    clearInterval(timer);
    animProg(100, pctEl, fillEl);
    await delay(420);
    lastResult = data;
    saveLocal(data);
    if (data.totalAnalyses) updateCounterDisplay(data.totalAnalyses);
    showResults(data);
  } catch (err) {
    clearInterval(timer);
    hide("loadingCard");
    show("errorCard");
    $("errMsg").textContent = err.message.includes("fetch")
      ? "Cannot connect to server. Run: cd backend && node server.js"
      : err.message;
  }
}

$("errRetry").addEventListener("click", resetAll);

function animProg(target, pctEl, fillEl) {
  const start = parseInt(pctEl.textContent) || 0;
  const diff  = target - start;
  if (diff <= 0) return;
  let f = 0;
  const t = setInterval(() => {
    f++;
    const v = Math.round(start + diff * f / 24);
    pctEl.textContent = v + "%";
    fillEl.style.width = v + "%";
    if (f >= 24) clearInterval(t);
  }, 16);
}

// ═══════════════════════════════════════════════════
//  SHOW RESULTS
// ═══════════════════════════════════════════════════
function showResults(d) {
  hide("loadingCard");
  show("resultsShell");

  $("aiTagText").textContent = d.aiPowered ? "✓ Groq LLaMA 3 AI" : "✓ Smart Analysis";

  buildPanel0(d);
  buildPanel1(d);
  buildPanel2(d);
  buildPanel3(d);
  buildPanel4(d);
  buildTabNav();
  goTab(0);

  setTimeout(() => $("resultsShell").scrollIntoView({behavior:"smooth"}), 150);
  setTimeout(initAOS, 80);
}

// ── PANEL 0 ──────────────────────────────────────────
function buildPanel0(d) {
  const arc   = $("scoreArc");
  const circ  = 346;
  const color = d.score >= 75 ? "#10b981" : d.score >= 50 ? "#f59e0b" : "#ef4444";
  arc.style.stroke = color;
  setTimeout(() => {
    arc.style.strokeDashoffset = circ - (d.score/100)*circ;
    countUp("ringNum", 0, d.score, 1100);
  }, 100);

  const grade = d.overallVerdict || (d.score>=80?"Excellent":d.score>=65?"Good":d.score>=45?"Average":"Weak");
  $("ringGrade").textContent = grade;
  $("ringVerdict").textContent = {Excellent:"Highly ATS-compatible.",Good:"Strong resume. Minor fixes recommended.",Average:"Passes basic ATS. Improvements needed.",Weak:"High rejection risk."}[grade] || "";

  setBar("mbAts",   d.score,              100,"mbAtsF");
  setBar("mbMatch", d.jobMatchScore,       100,"mbMatchF");
  $("mbKw").textContent = (d.keywordMatchPct||0)+"%";
  setPct("mbKwF",    d.keywordMatchPct||0);
  setBar("mbRead",  d.readabilityScore||60, 100,"mbReadF");

  // Contact chips
  const cc = $("contactChips"); cc.innerHTML="";
  [{l:"Email",v:d.contact?.hasEmail},{l:"Phone",v:d.contact?.hasPhone},{l:"LinkedIn",v:d.contact?.hasLinkedIn},{l:"GitHub",v:d.contact?.hasGitHub}]
    .forEach(c => cc.appendChild(chip("c-chip "+(c.v?"y":"n"),(c.v?"✓ ":"✗ ")+c.l)));

  // Section chips
  const sc=$("sectionChips"); sc.innerHTML="";
  (d.detectedSections||[]).forEach(s=>sc.appendChild(chip("s-chip",s)));
  if(!(d.detectedSections||[]).length) sc.innerHTML='<span style="font-size:.65rem;color:var(--t3)">None detected</span>';

  // Missing sections
  const mc=$("missingChips"); mc.innerHTML="";
  (d.missingSections||[]).forEach(s=>mc.appendChild(chip("m-chip","⚠ "+s)));
  if(!(d.missingSections||[]).length) mc.appendChild(chip("s-chip","None ✓"));

  $("summaryText").textContent = d.summary||"Analysis complete.";
  const vt=$("verdictTag");
  vt.textContent=grade;
  vt.className="verdict-tag vt-"+grade.toLowerCase();

  $("recruiterText").textContent = d.recruiterView||"See full analysis in the tabs.";

  $("stWc").textContent  = d.wordCount||"—";
  $("stAv").textContent  = d.foundActionVerbs?.length||0;
  $("stQa").textContent  = d.quantExamples?.length||(d.hasQuantified?"Yes":"No");
  $("stSk").textContent  = d.extractedSkills?.length||0;
}

// ── PANEL 1 ──────────────────────────────────────────
function buildPanel1(d) {
  const pct=d.keywordMatchPct||0;
  const mt=$("matchTag");
  mt.textContent=pct+"% Match";
  mt.style.background=pct>=60?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)";
  mt.style.color=pct>=60?"var(--green)":"var(--amber)";

  setTimeout(()=>{ setPct("tbMatch",d.jobMatchScore||0); setPct("tbAts",d.score||0); },180);
  $("tbMatchV").textContent=(d.jobMatchScore||0)+"/100";
  $("tbAtsV").textContent  =(d.score||0)+"/100";

  const fc=$("kwFound"); fc.innerHTML="";
  (d.keywordsMatched||[]).forEach((kw,i)=>{ const c=chip("kw-chip f",kw); c.style.animationDelay=i*28+"ms"; fc.appendChild(c); });
  if(!(d.keywordsMatched||[]).length) fc.innerHTML='<span style="font-size:.72rem;color:var(--t3)">None found</span>';

  const mc2=$("kwMiss"); mc2.innerHTML="";
  (d.missingKeywords||[]).forEach((kw,i)=>{ const c=chip("kw-chip m",kw); c.style.animationDelay=i*28+"ms"; mc2.appendChild(c); });
  if(!(d.missingKeywords||[]).length) mc2.innerHTML='<span style="font-size:.72rem;color:var(--green)">✓ None!</span>';

  $("kwFndCnt").textContent  = d.keywordsMatched?.length||0;
  $("kwMissCnt").textContent = d.missingKeywords?.length||0;

  const pl=$("priorityList"); pl.innerHTML="";
  const top5=d.top5Missing||d.missingKeywords?.slice(0,5)||[];
  top5.forEach((kw,i)=>{
    const row=document.createElement("div"); row.className="pitem";
    row.innerHTML=`<div class="pi-n">${i+1}</div><span class="pi-kw">${esc(kw)}</span><span class="pi-tag">Priority</span>`;
    pl.appendChild(row);
  });
  if(!pl.children.length) pl.innerHTML='<span style="color:var(--green);font-size:.78rem">✓ All keywords present!</span>';

  const sw=$("skillsWrap"); sw.innerHTML="";
  (d.extractedSkills||[]).forEach(s=>sw.appendChild(chip("sk-chip",s)));
  if(!(d.extractedSkills||[]).length) sw.innerHTML='<span style="font-size:.72rem;color:var(--t3)">None detected</span>';
}

// ── PANEL 2 ──────────────────────────────────────────
function buildPanel2(d) {
  const sl=$("strengthList"); sl.innerHTML="";
  const wl=$("weakList");     wl.innerHTML="";

  (d.strengths||["No data"]).forEach((s,i)=>{
    const li=document.createElement("li"); li.className="sw-item";
    li.style.animationDelay=i*50+"ms";
    li.innerHTML=`<div class="sw-dot g"></div><span>${esc(s)}</span>`;
    sl.appendChild(li);
  });
  (d.weaknesses||["No data"]).forEach((w,i)=>{
    const li=document.createElement("li"); li.className="sw-item";
    li.style.animationDelay=i*50+"ms";
    li.innerHTML=`<div class="sw-dot r"></div><span>${esc(w)}</span>`;
    wl.appendChild(li);
  });

  $("rwBody").textContent = d.rewriteSuggestion||"Add Groq API key for AI rewrite suggestions.";

  const pot=Math.min(100,d.score+Math.round((100-d.score)*.55));
  setTimeout(()=>{ $("baCur").style.width=d.score+"%"; $("baPot").style.width=pot+"%"; },260);
  $("baCurV").textContent=d.score+"/100";
  $("baPotV").textContent=pot+"/100";
}

// ── PANEL 3 ──────────────────────────────────────────
function buildPanel3(d) {
  const sl=$("suggList"); sl.innerHTML="";
  (d.suggestions||[]).forEach((item,i)=>{
    const li=document.createElement("li");
    li.className="sugg-item "+(item.startsWith("✅")?"si-pos":item.startsWith("⚠️")?"si-warn":item.startsWith("❌")?"si-bad":"si-tip");
    li.style.animationDelay=i*50+"ms";
    li.textContent=item;
    sl.appendChild(li);
  });
  if(!sl.children.length) sl.innerHTML='<li class="sugg-item si-tip">Upload a resume for personalized AI suggestions.</li>';

  const ll=$("liList"); ll.innerHTML="";
  (d.linkedInTips||[]).slice(0,5).forEach(t=>{
    const li=document.createElement("li"); li.className="li-item";
    li.innerHTML=`<div class="li-dot"></div><span>${esc(t)}</span>`;
    ll.appendChild(li);
  });

  $("pvText").textContent=d.textPreview||"No preview.";
  $("pvToggle").onclick=()=>{
    const pb=$("pvBody"), open=pb.style.display!=="none";
    pb.style.display=open?"none":"block";
    $("pvToggle").textContent=open?"Show ▾":"Hide ▴";
  };

  $("copySuggBtn").onclick=()=>{
    const text=(d.suggestions||[]).join("\n");
    navigator.clipboard.writeText(text)
      .then(()=>toast("Copied!","ok"))
      .catch(()=>toast("Copy failed.","err"));
  };
}

// ── PANEL 4 ──────────────────────────────────────────
function buildPanel4(d) {
  $("rolePill").textContent=d.role||"All Roles";

  const tg=$("tipsGrid"); tg.innerHTML="";
  (d.atsTips||[]).forEach((tip,i)=>{
    const c=document.createElement("div"); c.className="tip-card";
    c.innerHTML=`<div class="tc-num">0${i+1}</div><div class="tc-body">${esc(tip)}</div>`;
    tg.appendChild(c);
  });

  const ltg=$("liTipsGrid"); ltg.innerHTML="";
  (d.linkedInTips||[]).forEach(t=>{
    const el=document.createElement("div"); el.className="lti";
    el.innerHTML=`<div class="lti-dot"></div><span>${esc(t)}</span>`;
    ltg.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════
//  TAB / SLIDE NAV
// ═══════════════════════════════════════════════════
function buildTabNav() {
  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    const nb=btn.cloneNode(true);
    btn.parentNode.replaceChild(nb,btn);
    nb.addEventListener("click",()=>goTab(parseInt(nb.dataset.tab)));
  });

  // Dots
  const dots=$("snDots"); dots.innerHTML="";
  for(let i=0;i<TABS;i++){
    const d=document.createElement("div"); d.className="sn-dot"+(i===0?" active":"");
    d.addEventListener("click",()=>goTab(i));
    dots.appendChild(d);
  }

  // Arrows
  ["slidePrev","slideNext"].forEach(id=>{
    const nb=$(id).cloneNode(true);
    $(id).parentNode.replaceChild(nb,$(id));
  });
  $("slidePrev").addEventListener("click",()=>goTab(currentTab-1));
  $("slideNext").addEventListener("click",()=>goTab(currentTab+1));

  // Swipe
  const vp=$("panelsVp"); let tx=0;
  vp.addEventListener("touchstart",e=>tx=e.changedTouches[0].clientX,{passive:true});
  vp.addEventListener("touchend",e=>{ const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>44) goTab(currentTab+(dx<0?1:-1)); });
}

function goTab(idx) {
  currentTab=Math.max(0,Math.min(TABS-1,idx));
  $("panelsTrack").style.transform=`translateX(-${currentTab*100}%)`;
  document.querySelectorAll(".tab").forEach((b,i)=>b.classList.toggle("active",i===currentTab));
  document.querySelectorAll(".sn-dot").forEach((d,i)=>d.classList.toggle("active",i===currentTab));
  $("slidePrev").disabled=currentTab===0;
  $("slideNext").disabled=currentTab===TABS-1;

  // Retrigger bar animations when tab becomes visible
  if (!lastResult) return;
  const d=lastResult;
  if (currentTab===0) setTimeout(()=>{ setPct("mbAtsF",d.score); setPct("mbMatchF",d.jobMatchScore); setPct("mbKwF",d.keywordMatchPct); setPct("mbReadF",d.readabilityScore||60); },80);
  if (currentTab===1) setTimeout(()=>{ setPct("tbMatch",d.jobMatchScore); setPct("tbAts",d.score); },80);
  if (currentTab===2) {
    const pot=Math.min(100,d.score+Math.round((100-d.score)*.55));
    setTimeout(()=>{ $("baCur").style.width=d.score+"%"; $("baPot").style.width=pot+"%"; },120);
  }
}

// ═══════════════════════════════════════════════════
//  DOWNLOAD PDF REPORT
// ═══════════════════════════════════════════════════
$("downloadBtn").addEventListener("click", () => {
  if (!lastResult) { toast("Run analysis first.","err"); return; }
  const d=lastResult;
  const name=(document.querySelector("[data-tab='0'].tab")?.dataset?.userName)||"User";
  const role=(d.role||"Professional").replace(/\s+/g,"_");
  const score_color=d.score>=75?"#10b981":d.score>=50?"#f59e0b":"#ef4444";

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>ResumeRank Report</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;color:#1a1040;line-height:1.6;font-size:13.5px}
h1{color:#6d28d9;border-bottom:2px solid #6d28d9;padding-bottom:6px;font-size:20px;margin-bottom:4px}
h2{color:#2563eb;font-size:15px;margin-top:22px;margin-bottom:8px}
.score-wrap{text-align:center;margin:18px 0}
.score-big{font-size:54px;font-weight:900;color:${score_color};border:3px solid ${score_color};padding:14px 30px;border-radius:16px;display:inline-block}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin:14px 0}
.gbox{background:#f4f3ff;padding:8px 12px;border-radius:8px;text-align:center}
.gbox strong{display:block;font-size:20px;color:#6d28d9}
.gbox span{font-size:11px;color:#5a5280}
.chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;margin:2px;background:#ede9fe;color:#5b21b6}
.chip.r{background:#fee2e2;color:#991b1b}
.item{padding:6px 0;border-bottom:1px solid #ede9fe;font-size:13px;line-height:1.5}
.item:last-child{border:none}
@media print{body{padding:16px}}
</style></head><body>
<h1>ResumeRank — ATS Analysis Report</h1>
<p><strong>Role:</strong> ${d.role||"—"} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Analysis:</strong> ${d.aiPowered?"Groq LLaMA 3":"Smart Engine"}</p>
<div class="score-wrap"><div class="score-big">${d.score}/100</div></div>
<div class="grid4">
  <div class="gbox"><strong>${d.jobMatchScore||0}</strong><span>Job Match</span></div>
  <div class="gbox"><strong>${d.keywordMatchPct||0}%</strong><span>Keywords</span></div>
  <div class="gbox"><strong>${d.wordCount||0}</strong><span>Words</span></div>
  <div class="gbox"><strong>${d.extractedSkills?.length||0}</strong><span>Skills</span></div>
</div>
<h2>AI Assessment</h2><p>${d.summary||"—"}</p>
<h2>Recruiter View</h2><p><em>${d.recruiterView||"—"}</em></p>
<h2>Verdict: ${d.overallVerdict||"—"}</h2>
<h2>Strengths</h2>${(d.strengths||[]).map(s=>`<div class="item">✅ ${s}</div>`).join("")||"<p>—</p>"}
<h2>Weaknesses</h2>${(d.weaknesses||[]).map(w=>`<div class="item">⚠️ ${w}</div>`).join("")||"<p>—</p>"}
<h2>Keywords Found</h2><p>${(d.keywordsMatched||[]).map(k=>`<span class="chip">${k}</span>`).join("")||"None"}</p>
<h2>Missing Keywords</h2><p>${(d.missingKeywords||[]).map(k=>`<span class="chip r">${k}</span>`).join("")||"None!"}</p>
<h2>AI Suggestions</h2>${(d.suggestions||[]).map(s=>`<div class="item">${s}</div>`).join("")||"<p>—</p>"}
<h2>Instant Rewrite</h2><p>${d.rewriteSuggestion||"—"}</p>
<h2>ATS Expert Tips</h2>${(d.atsTips||[]).map((t,i)=>`<div class="item"><strong>${i+1}.</strong> ${t}</div>`).join("")}
<h2>LinkedIn Tips</h2>${(d.linkedInTips||[]).map(t=>`<div class="item">→ ${t}</div>`).join("")}
<hr style="margin-top:22px;border-color:#ede9fe"/>
<p style="font-size:11px;color:#9a8ab8;text-align:center;margin-top:8px">Generated by ResumeRank · AI-Powered ATS Analyzer</p>
</body></html>`;

  const fname=`${name.replace(/\s+/g,"_")}_${role}_Resume_Report.html`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=fname; a.click();
  URL.revokeObjectURL(url);
  toast("Report downloaded! Open in browser → Print → Save as PDF.","ok");
});

// ═══════════════════════════════════════════════════
//  RESET
// ═══════════════════════════════════════════════════
$("newAnalysisBtn").addEventListener("click", resetAll);

function resetAll() {
  selectedFile=null;
  fileInput.value="";
  $("fileBar").style.display="none";
  $("dropZone").style.display="block";
  $("analyzeBtn").disabled=true;
  show("uploadCard");
  hide("loadingCard","resultsShell","errorCard");
  $("analyzer-section").scrollIntoView({behavior:"smooth"});
}

// ═══════════════════════════════════════════════════
//  LIVE COUNTER
// ═══════════════════════════════════════════════════
async function fetchCounter() {
  try {
    const res=await fetch(`${API}/api/counter`);
    const {count}=await res.json();
    updateCounterDisplay(count);
  } catch { $("counterNum").textContent="—"; }
}

function updateCounterDisplay(n) {
  $("counterNum").textContent=n.toLocaleString();
}

// ═══════════════════════════════════════════════════
//  LOCAL STORAGE — Recent Analysis
// ═══════════════════════════════════════════════════
const LS="rr_result_v5";

function saveLocal(d) {
  try { localStorage.setItem(LS,JSON.stringify({d,ts:Date.now(),role:selectedRole,cat:selectedCat})); } catch {}
}

function showRecentBanner() {
  try {
    const raw=localStorage.getItem(LS);
    if(!raw) return;
    const {d,ts,role}=JSON.parse(raw);
    if(Date.now()-ts>86400000){ localStorage.removeItem(LS); return; }
    const bar=$("recentBar");
    $("recentLabel").textContent=`Score ${d.score}/100 · ${d.role} · ${new Date(ts).toLocaleDateString()}`;
    bar.style.display="flex";
    $("rbView").onclick=()=>{ lastResult=d; selectedRole=role; showResults(d); bar.style.display="none"; toast("Previous analysis loaded.","ok"); };
    $("rbX").onclick=()=>{ bar.style.display="none"; localStorage.removeItem(LS); };
  } catch {}
}

// ═══════════════════════════════════════════════════
//  RESUME BUILDER
// ═══════════════════════════════════════════════════
$("unlockBtn").addEventListener("click", () => {
  $("paymentOverlay").style.display="flex";
});
$("cancelPayBtn").addEventListener("click", () => {
  $("paymentOverlay").style.display="none";
});
$("payBtn").addEventListener("click", async () => {
  $("payBtn").textContent="Processing…";
  await delay(1800);
  $("paymentOverlay").style.display="none";
  builderUnlocked=true;
  hide("builderLocked");
  show("builderUi");
  toast("🎉 Builder unlocked! Select a template to begin.","ok");
  loadTemplates();
});

async function loadTemplates() {
  let templates=[];
  try {
    const res=await fetch(`${API}/api/builder/templates`);
    const data=await res.json();
    templates=data.templates||[];
  } catch {
    templates=[
      {id:"minimal",name:"Minimal",desc:"ATS-first clean layout"},
      {id:"modern",name:"Modern",desc:"Two-column with sidebar"},
      {id:"corporate",name:"Corporate",desc:"Traditional format"},
      {id:"creative",name:"Creative",desc:"Bold accent design"},
      {id:"student",name:"Student",desc:"Projects-forward"},
    ];
  }

  const tg=$("templateGrid"); tg.innerHTML="";
  templates.forEach(t=>{
    const btn=document.createElement("button");
    btn.className="tmpl-btn"+(t.id===selectedTemplate?" active":"");
    btn.type="button";
    btn.dataset.tid=t.id;
    btn.innerHTML=`<strong>${t.name}</strong><span class="ta">${t.desc}</span>`;
    btn.addEventListener("click",()=>{
      selectedTemplate=t.id;
      document.querySelectorAll(".tmpl-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
    });
    tg.appendChild(btn);
  });
}

$("generateResumeBtn").addEventListener("click", () => {
  if (!lastResult) { toast("Analyze a resume first to auto-fill.","err"); return; }
  const name=$("userNameInput").value.trim()||"Your Name";
  includeAiSkills=document.querySelector("input[name='aiSkill']:checked")?.value==="yes";
  generateResumeHTML(lastResult, name, selectedTemplate, includeAiSkills);
});

function generateResumeHTML(d, name, tmpl, useAi) {
  const skills=useAi
    ? [...new Set([...(d.extractedSkills||[]),...(d.keywordsMatched||[]),...(d.missingKeywords||[]).slice(0,4)])].slice(0,20)
    : (d.extractedSkills||[]).slice(0,20);

  const colors={minimal:"#1a1040",modern:"#0066cc",corporate:"#2d4739",creative:"#6d28d9",student:"#e85d04"};
  const accent=colors[tmpl]||"#1a1040";

  const styles={
    minimal:`body{font-family:Arial,sans-serif;color:#1a1040;padding:30px;font-size:13px;line-height:1.5}h1{font-size:22px;margin-bottom:2px;color:${accent}}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:${accent};border-bottom:1px solid #ddd;padding-bottom:4px;margin:16px 0 8px}p,li{font-size:13px}.chip{display:inline-block;background:#f3f0ff;color:${accent};padding:2px 9px;border-radius:4px;font-size:11px;margin:2px}`,
    modern:`body{font-family:Arial,sans-serif;display:grid;grid-template-columns:200px 1fr;min-height:100%;font-size:12.5px;line-height:1.5} .sidebar{background:${accent};color:white;padding:24px 16px}.main{padding:24px}h1{font-size:20px;margin-bottom:2px}h2{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;border-bottom:1px solid;padding-bottom:3px;margin:14px 0 7px}p,li{font-size:12.5px}.chip{display:inline-block;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;font-size:10.5px;margin:2px;color:white}`,
    corporate:`body{font-family:Georgia,serif;color:#1a1040;padding:28px;font-size:13px;line-height:1.6}h1{font-size:22px;text-align:center;margin-bottom:2px;color:${accent}}h2{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:${accent};border-top:2px solid ${accent};padding-top:6px;margin:16px 0 8px}p,li{font-size:13px}.chip{display:inline-block;background:#edf7ed;color:${accent};padding:2px 9px;border-radius:3px;font-size:11px;margin:2px}`,
    creative:`body{font-family:Arial,sans-serif;color:#1a1040;padding:0;font-size:13px}.header{background:${accent};color:white;padding:24px 30px}.main{padding:24px 30px}h1{font-size:24px;margin-bottom:2px}h2{font-size:11.5px;text-transform:uppercase;letter-spacing:1.8px;color:${accent};margin:16px 0 8px;padding-left:8px;border-left:3px solid ${accent}}p,li{font-size:13px;line-height:1.5}.chip{display:inline-block;background:#f0eaff;color:${accent};padding:2px 10px;border-radius:12px;font-size:11px;margin:2px}`,
    student:`body{font-family:Arial,sans-serif;color:#1a1040;padding:28px;font-size:13px;line-height:1.5}.name-bar{border-left:5px solid ${accent};padding-left:14px;margin-bottom:16px}h1{font-size:22px;margin-bottom:2px;color:${accent}}h2{font-size:11.5px;text-transform:uppercase;letter-spacing:1.5px;color:#555;border-bottom:1px dashed #ccc;padding-bottom:4px;margin:16px 0 8px}p,li{font-size:13px}.chip{display:inline-block;background:#fff3e0;color:${accent};padding:2px 9px;border-radius:6px;font-size:11px;margin:2px;border:1px solid ${accent}50}`,
  };

  const sections={
    minimal: (n,s)=>`<body>
<h1>${n}</h1><p>${d.role||"Professional"} · ${d.contact?.hasEmail?"email@example.com":""} · LinkedIn</p>
<h2>Professional Summary</h2><p>${(d.summary||"").substring(0,200)}</p>
<h2>Skills</h2><p>${s.map(sk=>`<span class="chip">${sk}</span>`).join("")}</p>
<h2>Experience</h2><p><em>Add your work experience, internships, and projects here with quantified achievements.</em></p>
<h2>Education</h2><p><em>Add your degree, institution, year, and CGPA/GPA here.</em></p>
<h2>Projects</h2><p><em>List 2–3 projects: title, tech stack, what you built, and impact metrics.</em></p>
${useAi?`<h2>AI-Suggested Keywords Added</h2><p style="font-size:11px;color:#888">The following keywords were added based on AI analysis to improve your ATS score:</p><p>${(d.missingKeywords||[]).slice(0,4).map(sk=>`<span class="chip">${sk}</span>`).join("")}</p>`:""}
</body>`,
    modern:`<div class="sidebar"><h1>${n}</h1><p>${d.role||"Professional"}</p><h2 style="color:white;border-color:rgba(255,255,255,.4)">Skills</h2>${s.map(sk=>`<span class="chip">${sk}</span>`).join("")}<h2 style="color:white;border-color:rgba(255,255,255,.4)">Contact</h2><p>LinkedIn · GitHub</p></div><div class="main"><h2>Summary</h2><p>${(d.summary||"").substring(0,200)}</p><h2>Experience</h2><p><em>Add work experience here.</em></p><h2>Education</h2><p><em>Add education here.</em></p><h2>Projects</h2><p><em>Add 2–3 projects here.</em></p></div>`,
  };

  const bodyContent=sections[tmpl]||(sections.minimal)(name,skills);

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${name} Resume</title><style>${styles[tmpl]||styles.minimal}</style></head>${bodyContent.includes("<body")?bodyContent:"<body>"+bodyContent+"</body>"}</html>`;

  $("resumePreview").innerHTML=html.replace(/<html>|<\/html>|<!DOCTYPE html>|<head>[\s\S]*?<\/head>/gi,"");
  show("resumePreviewWrap");

  $("downloadResumeBtn").onclick=()=>{
    const safeName=name.replace(/\s+/g,"_");
    const safeRole=(d.role||"Professional").replace(/\s+/g,"_");
    const fname=`${safeName}_${safeRole}_Resume.html`;
    const blob=new Blob([html],{type:"text/html"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=fname; a.click();
    URL.revokeObjectURL(url);
    toast(`Resume downloaded as ${fname}! Open in browser → Print → Save as PDF.`,"ok");
  };
}

// ═══════════════════════════════════════════════════
//  ATS TIPS SLIDER
// ═══════════════════════════════════════════════════
function initTips() {
  const track=$("tipsTrack");
  const dots=$("tipsDots");

  // Build dots
  for(let i=0;i<TIPS;i++){
    const d=document.createElement("div");
    d.className="tdot"+(i===0?" active":"");
    d.addEventListener("click",()=>goTip(i));
    dots.appendChild(d);
  }

  function goTip(i){ tipIdx=((i%TIPS)+TIPS)%TIPS; track.style.transform=`translateX(-${tipIdx*100}%)`; document.querySelectorAll(".tdot").forEach((d,j)=>d.classList.toggle("active",j===tipIdx)); }
  function startAuto(){ clearInterval(tipTimer); tipTimer=setInterval(()=>goTip(tipIdx+1),4800); }

  $("tipsPrev").addEventListener("click",()=>{ clearInterval(tipTimer); goTip(tipIdx-1); startAuto(); });
  $("tipsNext").addEventListener("click",()=>{ clearInterval(tipTimer); goTip(tipIdx+1); startAuto(); });

  const tw=document.querySelector(".tips-wrap");
  tw?.addEventListener("mouseenter",()=>clearInterval(tipTimer));
  tw?.addEventListener("mouseleave",startAuto);

  let tx2=0;
  tw?.addEventListener("touchstart",e=>tx2=e.changedTouches[0].clientX,{passive:true});
  tw?.addEventListener("touchend",e=>{ const dx=e.changedTouches[0].clientX-tx2; if(Math.abs(dx)>44){ clearInterval(tipTimer); goTip(tipIdx+(dx<0?1:-1)); startAuto(); } });

  startAuto();
}

// ═══════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════
function show(...ids){ ids.forEach(id=>{ const el=$(id); if(el) el.style.display="block"; }); }
function hide(...ids){ ids.forEach(id=>{ const el=$(id); if(el) el.style.display="none"; }); }

function setBar(valId,val,max,barId){
  if($(valId)) $(valId).textContent=val||0;
  setPct(barId, Math.round((val/max)*100));
}
function setPct(barId,pct){
  const el=$(barId); if(el) setTimeout(()=>el.style.width=Math.min(100,Math.max(0,Math.round(pct)))+"%",300);
}
function countUp(id,start,end,dur){
  const el=$(id); if(!el) return;
  const s=performance.now();
  function step(now){ const p=Math.min((now-s)/dur,1); el.textContent=Math.round(start+(end-start)*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
function chip(cls,txt){ const el=document.createElement("span"); el.className=cls; el.textContent=txt; return el; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmtBytes(b){ return b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB"; }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
function toast(msg,type="info"){
  document.querySelectorAll(".toast").forEach(t=>t.remove());
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  t.style.background=type==="err"?"#dc2626":type==="ok"?"#059669":"#6d28d9";
  document.body.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity="1"; t.style.transform="translateX(-50%) translateY(0)"; });
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateX(-50%) translateY(10px)"; setTimeout(()=>t.remove(),280); },3500);
}
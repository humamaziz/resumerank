/* ═══════════════════════════════════════════════════════════
   ResumeRank v4 — script.js
   FIXED: slider, localStorage, overflow, all UI bugs
   NEW: feature modals, job suggestions, filename gen, recent banner
══════════════════════════════════════════════════════════ */

const API_URL = "https://resumerank-w8h2.onrender.com/analyze";

/* ── ROLE DATA ── */
const ROLE_KW_PREVIEW = {
  software_dev:     ["JavaScript","Python","Git","SQL","Docker"],
  frontend:         ["React","TypeScript","CSS","Webpack","Figma"],
  backend:          ["Node.js","Python","SQL","Docker","Redis"],
  fullstack:        ["React","Node.js","MongoDB","TypeScript","Git"],
  data_science:     ["Python","ML","SQL","TensorFlow","Pandas"],
  devops:           ["Docker","Kubernetes","AWS","CI/CD","Linux"],
  ui_ux:            ["Figma","Wireframing","Prototyping","Adobe XD","UX Research"],
  marketing:        ["SEO","Google Ads","Analytics","CRM","Content"],
  product:          ["Agile","JIRA","Roadmap","A/B Testing","KPIs"],
  business_analyst: ["SQL","Excel","JIRA","Tableau","Requirements"],
};

const ROLE_LABELS = {
  software_dev:"Software Developer", frontend:"Frontend Developer",
  backend:"Backend Developer", fullstack:"Full Stack Developer",
  data_science:"Data Scientist", devops:"DevOps Engineer",
  ui_ux:"UI/UX Designer", marketing:"Digital Marketer",
  product:"Product Manager", business_analyst:"Business Analyst",
};

/* ── RELATED ROLES (for job suggestions) ── */
const RELATED_ROLES = {
  software_dev:     ["Full Stack Developer","Backend Developer","DevOps Engineer"],
  frontend:         ["UI/UX Designer","Full Stack Developer","Product Manager"],
  backend:          ["DevOps Engineer","Full Stack Developer","Software Developer"],
  fullstack:        ["Frontend Developer","Backend Developer","Software Developer"],
  data_science:     ["Business Analyst","Software Developer","Product Manager"],
  devops:           ["Backend Developer","Software Developer","Business Analyst"],
  ui_ux:            ["Frontend Developer","Product Manager","Digital Marketer"],
  marketing:        ["Product Manager","Business Analyst","UI/UX Designer"],
  product:          ["Business Analyst","UI/UX Designer","Digital Marketer"],
  business_analyst: ["Data Scientist","Product Manager","Software Developer"],
};

/* ── FEATURE MODAL CONTENT ── */
const FEATURE_MODALS = {
  score: {
    title: "AI Summary & Verdict",
    content: `<p>After analyzing your resume, our AI provides a <strong>2–3 sentence professional assessment</strong> from the perspective of a recruiter hiring for your target role.</p>
    <ul>
      <li>Uses Groq LLaMA 3 for natural language analysis</li>
      <li>Falls back to intelligent static scoring if no API key</li>
      <li>Gives an Overall Verdict: Excellent / Good / Average / Weak</li>
      <li>Explains exactly what's helping and what's hurting your score</li>
    </ul>
    <p>The verdict appears on the Score tab of your dashboard after upload.</p>`,
    cta: "Analyze Now",
    href: "#analyzer"
  },
  keywords: {
    title: "Role-Based Keyword Match",
    content: `<p>Every job role has a specific set of keywords that ATS systems look for. Our analyzer compares your resume against <strong>15 role-specific keywords</strong> and shows you exactly what's missing.</p>
    <ul>
      <li>10 job roles supported (Software Dev, Data Science, DevOps, etc.)</li>
      <li>Shows percentage match for your selected role</li>
      <li>Lists top 5 missing keywords — highest priority first</li>
      <li>Highlights all detected technical skills from your resume</li>
    </ul>
    <p>Select your target role in the analyzer to get personalized keyword results.</p>`,
    cta: "Check Keywords",
    href: "#analyzer"
  },
  dashboard: {
    title: "5-Tab Interactive Dashboard",
    content: `<p>Your analysis results are organized into <strong>5 tabs</strong> so you can dig into every aspect of your resume without feeling overwhelmed.</p>
    <ul>
      <li><strong>Score:</strong> ATS score ring, 4 metric bars, contact info, AI summary</li>
      <li><strong>Keywords:</strong> Found / missing chips, top 5 priority gaps, all skills</li>
      <li><strong>Strengths:</strong> What's working + what needs fixing + before/after rewrite</li>
      <li><strong>AI Feedback:</strong> 5 specific suggestions + LinkedIn tips + text preview</li>
      <li><strong>Expert Tips:</strong> 10 ATS tips + 7 LinkedIn optimization tips</li>
    </ul>`,
    cta: "View Dashboard",
    href: "#analyzer"
  },
  rewrite: {
    title: "AI Instant Rewrite Suggestion",
    content: `<p>One of the most powerful features — our AI picks your weakest bullet point and rewrites it into a strong, quantified, ATS-optimized version.</p>
    <ul>
      <li>Shows the original weak line (BEFORE)</li>
      <li>Shows the AI-improved version (AFTER)</li>
      <li>Uses impact verbs, quantified metrics, and role keywords</li>
      <li>You can copy it and directly update your resume</li>
    </ul>
    <p><em>Example: "BEFORE: Worked on backend development → AFTER: Engineered RESTful APIs handling 10K+ requests/day, reducing response time by 35% using Node.js and Redis."</em></p>`,
    cta: "Try It Now",
    href: "#analyzer"
  },
  recruiter: {
    title: "Recruiter View Mode",
    content: `<p>Recruiters spend an average of <strong>7.4 seconds</strong> on a first resume scan. This feature shows you exactly what a recruiter would think in those first 10 seconds.</p>
    <ul>
      <li>Assesses immediate visual and content impression</li>
      <li>Tells you if you'd pass or fail the "10-second test"</li>
      <li>Based on ATS score, keyword density, and section completeness</li>
      <li>Helps you prioritize what to fix first</li>
    </ul>
    <p>Found on the Score tab after analysis — scroll down past the AI Assessment.</p>`,
    cta: "See Recruiter View",
    href: "#analyzer"
  },
  report: {
    title: "PDF Report Download",
    content: `<p>After your analysis, you can download a <strong>complete HTML report</strong> with all scores, feedback, and suggestions — ready to print as PDF or share.</p>
    <ul>
      <li>Includes ATS score, job match score, keyword match percentage</li>
      <li>Full strengths and weaknesses breakdown</li>
      <li>AI suggestions and rewrite example</li>
      <li>All 10 ATS expert tips and LinkedIn optimization tips</li>
    </ul>
    <p>Click <strong>"Download Report"</strong> in the results header. Open the HTML file in your browser and use Print → Save as PDF to get a PDF version.</p>`,
    cta: "Analyze to Download",
    href: "#analyzer"
  }
};

/* ── DOM REFS ── */
const $ = id => document.getElementById(id);
const themeToggle   = $("themeToggle");
const hamburger     = $("hamburger");
const mobileMenu    = $("mobileMenu");
const navbar        = $("navbar");
const jobRoleSelect = $("jobRoleSelect");
const rkwPills      = $("rkwPills");
const dropZone      = $("dropZone");
const fileInput     = $("fileInput");
const browseBtn     = $("browseBtn");
const fileBar       = $("fileBar");
const analyzeBtn    = $("analyzeBtn");
const analyzerCard  = $("analyzerCard");
const loadingState  = $("loadingState");
const resultsShell  = $("resultsShell");
const errorState    = $("errorState");
const tipsTrack     = $("tipsTrack");
const tipsDots      = $("tipsDots");

let selectedFile = null;
let currentSlide = 0;
const TOTAL_SLIDES = 5;
let currentTip = 0;
const TOTAL_TIPS = 7;
let tipsTimer = null;
let lastResult = null;

/* ═══════════════════════════════════════════
   1. THEME — persisted via localStorage
═══════════════════════════════════════════ */
const setTheme = t => {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("rr-theme", t);
};
setTheme(localStorage.getItem("rr-theme") || "dark");
themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

/* ═══════════════════════════════════════════
   2. NAVBAR
═══════════════════════════════════════════ */
window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", scrollY > 40), { passive: true });
hamburger.addEventListener("click", () => mobileMenu.classList.toggle("open"));
document.querySelectorAll(".m-link, .mobile-menu .btn-nav-cta").forEach(el =>
  el.addEventListener("click", () => mobileMenu.classList.remove("open"))
);
// Close mobile menu on outside click
document.addEventListener("click", e => {
  if (!navbar.contains(e.target)) mobileMenu.classList.remove("open");
});

/* ═══════════════════════════════════════════
   3. SCROLL REVEAL
═══════════════════════════════════════════ */
function initAOS() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const d = parseInt(e.target.getAttribute("data-aos-delay") || 0);
        setTimeout(() => e.target.classList.add("aos-animate"), d);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll("[data-aos]").forEach(t => {
    if (!t.classList.contains("aos-animate")) io.observe(t);
  });
}
initAOS();

/* ═══════════════════════════════════════════
   4. SMOOTH SCROLL
═══════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + scrollY - navbar.offsetHeight - 12;
      window.scrollTo({ top, behavior: "smooth" });
    }
  });
});

/* ═══════════════════════════════════════════
   5. FEATURE CARDS — MODAL ON CLICK
═══════════════════════════════════════════ */
const modalOverlay = $("featModalOverlay");
const modalBody    = $("featModalBody");

document.querySelectorAll(".feat-card[data-feature]").forEach(card => {
  card.addEventListener("click", () => openFeatureModal(card.dataset.feature));
  card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openFeatureModal(card.dataset.feature); });
});

function openFeatureModal(key) {
  const m = FEATURE_MODALS[key];
  if (!m) return;
  modalBody.innerHTML = `
    <div class="fi purple" style="margin-bottom:1rem">${getFeatureIcon(key)}</div>
    <h2 id="featModalTitle">${m.title}</h2>
    ${m.content}
    <a href="${m.href}" class="fm-cta">${m.cta} →</a>
  `;
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  $("featModalClose").focus();
}

function closeFeatureModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

$("featModalClose").addEventListener("click", closeFeatureModal);
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeFeatureModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeFeatureModal(); });

function getFeatureIcon(key) {
  const icons = {
    score:    `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M11 7v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    keywords: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M3 11h10M3 16h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    dashboard:`<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 16l4-4 3 3 7-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    rewrite:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3l2 6h6l-5 3.5 2 6L11 15l-5 3.5 2-6L3 9h6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    recruiter:`<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    report:   `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 14v4a2 2 0 002 2h10a2 2 0 002-2v-4M11 3v12M7 11l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  return icons[key] || "";
}

/* ═══════════════════════════════════════════
   6. ROLE KEYWORD PILLS
═══════════════════════════════════════════ */
function renderRolePills(role) {
  rkwPills.innerHTML = "";
  (ROLE_KW_PREVIEW[role] || []).slice(0, 4).forEach(kw => {
    const p = document.createElement("span");
    p.className = "rkw-pill";
    p.textContent = kw;
    rkwPills.appendChild(p);
  });
}
renderRolePills(jobRoleSelect.value);
jobRoleSelect.addEventListener("change", () => renderRolePills(jobRoleSelect.value));

/* ═══════════════════════════════════════════
   7. FILE UPLOAD — drag, drop, browse
═══════════════════════════════════════════ */
browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
fileInput.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over"); });
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Touch swipe support
let touchStartX = 0;
document.addEventListener("touchstart", e => touchStartX = e.changedTouches[0].clientX, { passive: true });

function handleFile(file) {
  if (file.type !== "application/pdf") { toast("Please upload a PDF file only.", "error"); return; }
  if (file.size > 5 * 1024 * 1024) { toast("File too large. Max 5MB allowed.", "error"); return; }
  selectedFile = file;
  dropZone.style.display = "none";
  $("fbName").textContent = file.name;
  $("fbSize").textContent = fmtBytes(file.size);
  fileBar.style.display = "flex";
  analyzeBtn.disabled = false;
}

$("fbRemove").addEventListener("click", resetUpload);

function resetUpload() {
  selectedFile = null;
  fileInput.value = "";
  fileBar.style.display = "none";
  dropZone.style.display = "block";
  analyzeBtn.disabled = true;
}

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

/* ═══════════════════════════════════════════
   8. ANALYZE — API CALL
═══════════════════════════════════════════ */
analyzeBtn.addEventListener("click", () => { if (selectedFile) startAnalysis(); });

async function startAnalysis() {
  analyzerCard.style.display = "none";
  loadingState.style.display = "block";
  resultsShell.style.display = "none";
  errorState.style.display   = "none";

  const steps   = ["ls1","ls2","ls3","ls4","ls5"];
  const titles  = ["Parsing resume…","Analyzing skills…","Matching keywords…","AI generating feedback…","Building your report…"];
  const targets = [18, 38, 58, 80, 100];
  const pctEl   = $("ldPct");
  const fillEl  = $("progFill");
  const titleEl = $("ldTitle");
  steps.forEach(id => $(id).classList.remove("done"));

  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    if (stepIdx >= steps.length) { clearInterval(stepTimer); return; }
    $(steps[stepIdx]).classList.add("done");
    titleEl.textContent = titles[stepIdx];
    animProg(targets[stepIdx], pctEl, fillEl);
    stepIdx++;
  }, 700);

  const fd = new FormData();
  fd.append("resume", selectedFile);
  fd.append("role", jobRoleSelect.value);

  try {
    const res = await fetch(API_URL, { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    const data = await res.json();
    clearInterval(stepTimer);
    animProg(100, pctEl, fillEl);
    await delay(450);
    lastResult = data;
    // Save to localStorage
    saveToStorage(data);
    showResults(data);
  } catch (err) {
    clearInterval(stepTimer);
    loadingState.style.display = "none";
    errorState.style.display   = "block";
    $("errDetail").textContent = err.message.includes("fetch")
      ? "Cannot connect to server. Make sure Node.js is running: cd backend && node server.js"
      : err.message;
  }
}

function animProg(target, pctEl, fillEl) {
  const start = parseInt(pctEl.textContent) || 0;
  const diff = target - start;
  if (diff <= 0) return;
  let f = 0; const tot = 24;
  const t = setInterval(() => {
    f++;
    const v = Math.round(start + diff * f / tot);
    pctEl.textContent = v + "%";
    fillEl.style.width = v + "%";
    fillEl.parentElement?.setAttribute("aria-valuenow", v);
    if (f >= tot) clearInterval(t);
  }, 16);
}

/* ═══════════════════════════════════════════
   9. SHOW RESULTS DASHBOARD
═══════════════════════════════════════════ */
function showResults(d) {
  loadingState.style.display = "none";
  resultsShell.style.display = "block";

  // AI badge
  $("aiBadgeText").textContent = d.aiPowered ? "✓ AI Analysis (Groq LLaMA 3)" : "✓ Smart Analysis";

  // Build each slide
  buildSlide0(d);
  buildSlide1(d);
  buildSlide2(d);
  buildSlide3(d);
  buildSlide4(d);

  // Reset and build nav
  buildSlideNav();
  goToSlide(0);

  // Scroll to section
  setTimeout(() => $("analyzer").scrollIntoView({ behavior: "smooth" }), 120);
  setTimeout(initAOS, 80);
}

/* ── SLIDE 0: SCORE ── */
function buildSlide0(d) {
  // Score ring animation
  const scoreArc = $("scoreArc");
  const circumf  = 352;
  const arcColor = d.score >= 75 ? "#10b981" : d.score >= 50 ? "#f59e0b" : "#ef4444";
  scoreArc.style.stroke = arcColor;
  setTimeout(() => {
    scoreArc.style.strokeDashoffset = circumf - (d.score / 100) * circumf;
    animNum("scNum", 0, d.score, 1100);
  }, 100);

  // Grade
  const gradeMap = s => s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Average" : "Weak";
  const grade = d.overallVerdict || gradeMap(d.score);
  setEl("scGrade", grade);
  const verdicts = { Excellent:"Highly ATS-compatible.", Good:"Strong resume. Minor tweaks recommended.", Average:"Passes basic ATS. Improvements needed.", Weak:"High rejection risk. Follow suggestions." };
  setEl("scVerdict", verdicts[grade] || "");

  // Metric bars
  setMetricBar("mbAts",   d.score,           100, "mbAtsF");
  setMetricBar("mbMatch", d.jobMatchScore,   100, "mbMatchF");
  setEl("mbKw", (d.keywordMatchPct || 0) + "%");
  setBarPct("mbKwF",   d.keywordMatchPct   || 0);
  setMetricBar("mbRead", d.readabilityScore || 60, 100, "mbReadF");

  // Contact chips
  renderChips("contactChips", [
    {label:"Email",    ok: d.contact?.hasEmail,    cls:"contact-chip"},
    {label:"Phone",    ok: d.contact?.hasPhone,    cls:"contact-chip"},
    {label:"LinkedIn", ok: d.contact?.hasLinkedIn, cls:"contact-chip"},
    {label:"GitHub",   ok: d.contact?.hasGitHub,   cls:"contact-chip"},
  ], c => ({ className: c.cls + (c.ok ? " yes" : " no"), text: (c.ok ? "✓ " : "✗ ") + c.label }));

  // Section chips
  const sc = $("sectionChips"); sc.innerHTML = "";
  (d.detectedSections || []).forEach(s => sc.appendChild(mkEl("span","section-chip",s)));
  if (!d.detectedSections?.length) sc.innerHTML = '<span style="font-size:.72rem;color:var(--text3)">None detected</span>';

  // Missing section chips
  const mc = $("missingSectionChips"); mc.innerHTML = "";
  (d.missingSections || []).forEach(s => mc.appendChild(mkEl("span","missing-chip","⚠ "+s)));
  if (!d.missingSections?.length) mc.appendChild(mkEl("span","section-chip","None ✓"));

  // AI Summary
  setEl("sumBody", d.summary || "Analysis complete. See detailed results in each tab.");
  const vEl = $("sumVerdict");
  vEl.textContent = grade;
  vEl.className = "scard-verdict verdict-" + grade.toLowerCase();

  // Recruiter view
  setEl("recBody", d.recruiterView || "See your full analysis in the dashboard tabs.");

  // Mini stats
  setEl("msWc",  d.wordCount                    || "—");
  setEl("msAv",  d.foundActionVerbs?.length      || 0);
  setEl("msQa",  d.quantExamples?.length         || (d.hasQuantifiedAchievements ? "Yes" : "No"));
  setEl("msSk",  d.extractedSkills?.length       || 0);

  // Job Role Suggestions
  const related = RELATED_ROLES[jobRoleSelect.value] || [];
  if (related.length) {
    const rsCard = $("roleSuggestCard");
    rsCard.style.display = "block";
    const rsChips = $("roleSuggestChips"); rsChips.innerHTML = "";
    related.forEach(role => {
      const chip = mkEl("span","rs-chip",role);
      chip.title = `Click to apply for ${role}`;
      rsChips.appendChild(chip);
    });
  }

  // Filename suggestion
  const nameParts = (d.textPreview || "").match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
  const roleName  = (d.role || "Professional").replace(/\s+/g, "_");
  const suggested = nameParts
    ? nameParts[1].replace(/\s+/g,"_") + "_" + roleName + "_Resume.pdf"
    : "FirstName_LastName_" + roleName + "_Resume.pdf";
  const fnCard = $("filenameCard");
  fnCard.style.display = "block";
  setEl("fnName", suggested);
  $("fnCopy").onclick = () => {
    navigator.clipboard.writeText(suggested)
      .then(() => toast("Filename copied!", "success"))
      .catch(() => toast("Copy failed.", "error"));
  };
}

/* ── SLIDE 1: KEYWORDS ── */
function buildSlide1(d) {
  const pct = d.keywordMatchPct || 0;
  const badge = $("matchPctBadge");
  badge.textContent = pct + "% Match";
  badge.style.background = pct >= 60 ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.12)";
  badge.style.color = pct >= 60 ? "#10b981" : "#fbbf24";

  // Match bars (animate after DOM settles)
  setTimeout(() => {
    setBarPct("kSlideMatch", d.jobMatchScore || 0);
    setBarPct("kSlideAts",   d.score         || 0);
  }, 180);
  setEl("kSlideMatchV", (d.jobMatchScore || 0) + "/100");
  setEl("kSlideAtsV",   (d.score         || 0) + "/100");

  // Found keywords
  const found = $("kwFndChips"); found.innerHTML = "";
  (d.keywordsMatched || []).forEach((kw, i) => {
    const c = mkEl("span","kw-chip found", kw);
    c.style.animationDelay = (i * 30) + "ms";
    found.appendChild(c);
  });
  if (!d.keywordsMatched?.length) found.innerHTML = '<span style="font-size:.78rem;color:var(--text3)">No role keywords detected</span>';

  // Missing keywords
  const miss = $("kwMissChips"); miss.innerHTML = "";
  (d.missingKeywords || []).forEach((kw, i) => {
    const c = mkEl("span","kw-chip missing", kw);
    c.style.animationDelay = (i * 30) + "ms";
    miss.appendChild(c);
  });
  if (!d.missingKeywords?.length) miss.innerHTML = '<span style="font-size:.78rem;color:#10b981">✓ No critical gaps!</span>';

  setEl("kwFndCount",  d.keywordsMatched?.length || 0);
  setEl("kwMissCount", d.missingKeywords?.length || 0);

  // Top 5 missing
  const t5 = $("top5List"); t5.innerHTML = "";
  const top5 = d.top5Missing || d.missingKeywords?.slice(0, 5) || [];
  top5.forEach((kw, i) => {
    const row = document.createElement("div");
    row.className = "t5-item";
    row.innerHTML = `<div class="t5-rank">${i+1}</div><span class="t5-kw">${kw}</span><span class="t5-tag">High Priority</span>`;
    t5.appendChild(row);
  });
  if (!t5.children.length) t5.innerHTML = '<span style="color:#10b981;font-size:.8rem">✓ All role keywords present!</span>';

  // All skills
  const sk = $("skillsChips"); sk.innerHTML = "";
  (d.extractedSkills || []).forEach(s => sk.appendChild(mkEl("span","skill-chip",s)));
  if (!d.extractedSkills?.length) sk.innerHTML = '<span style="font-size:.78rem;color:var(--text3)">No skills detected</span>';
}

/* ── SLIDE 2: STRENGTHS / WEAKNESSES ── */
function buildSlide2(d) {
  const sl = $("strengthsList"); sl.innerHTML = "";
  const wl = $("weaknessesList"); wl.innerHTML = "";

  (d.strengths || ["No strengths data available"]).forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "sw-item";
    li.style.animationDelay = (i * 55) + "ms";
    li.innerHTML = `<div class="sw-dot g"></div><span>${escHtml(s)}</span>`;
    sl.appendChild(li);
  });
  (d.weaknesses || ["No weaknesses data available"]).forEach((w, i) => {
    const li = document.createElement("li");
    li.className = "sw-item";
    li.style.animationDelay = (i * 55) + "ms";
    li.innerHTML = `<div class="sw-dot r"></div><span>${escHtml(w)}</span>`;
    wl.appendChild(li);
  });

  // Rewrite suggestion
  setEl("rwBody", d.rewriteSuggestion || "Add a free Groq API key to get AI-powered instant rewrite suggestions.");

  // Before / After
  const potential = Math.min(100, d.score + Math.round((100 - d.score) * 0.55));
  setTimeout(() => {
    $("baCur").style.width = d.score    + "%";
    $("baPot").style.width = potential  + "%";
  }, 260);
  setEl("baCurV", d.score + "/100");
  setEl("baPotV", potential + "/100");
}

/* ── SLIDE 3: AI SUGGESTIONS ── */
function buildSlide3(d) {
  // Suggestions list
  const sl = $("suggList"); sl.innerHTML = "";
  const suggs = d.suggestions || [];
  suggs.forEach((item, i) => {
    const li = document.createElement("li");
    const cls = item.startsWith("✅") ? "pos" : item.startsWith("⚠️") ? "warn" : item.startsWith("❌") ? "bad" : "tip";
    li.className = "sugg-item " + cls;
    li.style.animationDelay = (i * 50) + "ms";
    li.textContent = item;
    sl.appendChild(li);
  });
  if (!sl.children.length) {
    sl.innerHTML = '<li class="sugg-item tip">Upload a resume to get personalized AI suggestions.</li>';
  }

  // LinkedIn tips
  const ll = $("liList"); ll.innerHTML = "";
  (d.linkedInTips || []).slice(0, 5).forEach(tip => {
    const li = document.createElement("li");
    li.className = "li-item";
    li.innerHTML = `<div class="li-dot"></div><span>${escHtml(tip)}</span>`;
    ll.appendChild(li);
  });

  // Preview text
  setEl("prevText", d.textPreview || "No preview available.");

  // Preview toggle
  const ptBtn = $("prevToggle");
  const pb = $("prevBody");
  ptBtn.onclick = () => {
    const open = pb.style.display !== "none";
    pb.style.display = open ? "none" : "block";
    ptBtn.textContent = open ? "Show ▾" : "Hide ▴";
  };

  // Copy suggestions button
  $("copySuggestionsBtn").onclick = () => {
    const text = suggs.join("\n");
    navigator.clipboard.writeText(text)
      .then(() => toast("Suggestions copied!", "success"))
      .catch(() => toast("Copy failed. Try manually.", "error"));
  };
}

/* ── SLIDE 4: EXPERT TIPS ── */
function buildSlide4(d) {
  setEl("tipsRoleTag", d.role || "All Roles");

  const grid = $("atsTipsGrid"); grid.innerHTML = "";
  (d.atsTips || []).forEach((tip, i) => {
    const card = document.createElement("div");
    card.className = "ats-tip-card";
    card.innerHTML = `<div class="atc-num">0${i+1}</div><div class="atc-body">${escHtml(tip)}</div>`;
    grid.appendChild(card);
  });

  const liGrid = $("liTipsGrid"); liGrid.innerHTML = "";
  (d.linkedInTips || []).forEach(tip => {
    const el = document.createElement("div");
    el.className = "li-tip-item";
    el.innerHTML = `<div class="lti-dot"></div><span>${escHtml(tip)}</span>`;
    liGrid.appendChild(el);
  });
}

/* ═══════════════════════════════════════════
   10. SLIDE NAVIGATION (FIXED)
═══════════════════════════════════════════ */
function buildSlideNav() {
  // Dots
  const dotsEl = $("slideDots"); dotsEl.innerHTML = "";
  for (let i = 0; i < TOTAL_SLIDES; i++) {
    const dot = document.createElement("div");
    dot.className = "sdot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goToSlide(i));
    dotsEl.appendChild(dot);
  }

  // Tab click handlers (remove old listeners by cloning)
  document.querySelectorAll(".stab").forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", () => goToSlide(parseInt(fresh.getAttribute("data-slide"))));
  });

  // Arrow buttons (also clone to remove stale listeners)
  const prevBtn = $("slidePrev");
  const nextBtn = $("slideNext");
  const newPrev = prevBtn.cloneNode(true);
  const newNext = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  nextBtn.parentNode.replaceChild(newNext, nextBtn);
  newPrev.addEventListener("click", () => goToSlide(currentSlide - 1));
  newNext.addEventListener("click", () => goToSlide(currentSlide + 1));

  // Touch swipe on slides viewport
  const vp = $("slidesViewport");
  let txStart = 0;
  vp.addEventListener("touchstart", e => txStart = e.changedTouches[0].clientX, { passive: true });
  vp.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - txStart;
    if (Math.abs(dx) > 45) goToSlide(currentSlide + (dx < 0 ? 1 : -1));
  });
}

function goToSlide(idx) {
  currentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, idx));

  // Move track
  $("slidesTrack").style.transform = `translateX(-${currentSlide * 100}%)`;

  // Sync dots
  document.querySelectorAll(".sdot").forEach((d, i) => d.classList.toggle("active", i === currentSlide));

  // Sync tabs
  document.querySelectorAll(".stab").forEach(btn => {
    const isActive = parseInt(btn.getAttribute("data-slide")) === currentSlide;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });

  // Sync tab panels visibility
  document.querySelectorAll(".slide").forEach((s, i) => {
    s.setAttribute("aria-hidden", i !== currentSlide);
  });

  // Arrows
  const pBtn = $("slidePrev");
  const nBtn = $("slideNext");
  if (pBtn) pBtn.disabled = currentSlide === 0;
  if (nBtn) nBtn.disabled = currentSlide === TOTAL_SLIDES - 1;

  // Re-trigger bar animations for the newly visible slide
  if (!lastResult) return;
  const d = lastResult;
  if (currentSlide === 0) {
    setTimeout(() => {
      setBarPct("mbAtsF",   d.score             || 0);
      setBarPct("mbMatchF", d.jobMatchScore      || 0);
      setBarPct("mbKwF",    d.keywordMatchPct    || 0);
      setBarPct("mbReadF",  d.readabilityScore   || 60);
    }, 80);
  }
  if (currentSlide === 1) {
    setTimeout(() => {
      setBarPct("kSlideMatch", d.jobMatchScore || 0);
      setBarPct("kSlideAts",   d.score         || 0);
    }, 80);
  }
  if (currentSlide === 2) {
    const potential = Math.min(100, d.score + Math.round((100 - d.score) * 0.55));
    setTimeout(() => {
      $("baCur").style.width = d.score   + "%";
      $("baPot").style.width = potential + "%";
    }, 120);
  }
}

/* ═══════════════════════════════════════════
   11. DOWNLOAD PDF REPORT
═══════════════════════════════════════════ */
$("downloadReportBtn").addEventListener("click", () => {
  if (!lastResult) { toast("No analysis to download yet.", "error"); return; }
  const d = lastResult;
  const scoreColor = d.score >= 75 ? "#10b981" : d.score >= 50 ? "#f59e0b" : "#ef4444";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>ResumeRank Report — ${d.role || "Resume"}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:28px;color:#1a1040;line-height:1.6;font-size:14px}
h1{color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;font-size:22px}
h2{color:#2563eb;margin-top:22px;font-size:16px}
.score-box{text-align:center;margin:20px 0}
.score-num{font-size:52px;font-weight:900;color:${scoreColor};border:3px solid ${scoreColor};padding:16px 32px;border-radius:16px;display:inline-block}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
.meta-cell{background:#f8f7ff;padding:8px 12px;border-radius:8px}
.meta-cell strong{display:block;font-size:20px;color:#7c3aed;font-weight:700}
.meta-cell span{font-size:12px;color:#5a5280}
.chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;margin:2px;background:#ede9fe;color:#5b21b6}
.chip.miss{background:#fee2e2;color:#991b1b}
.item{padding:7px 0;border-bottom:1px solid #f0eeff;font-size:13px;line-height:1.5}
.item:last-child{border:none}
@media print{body{padding:14px}}
</style></head><body>
<h1>ResumeRank — ATS Analysis Report</h1>
<p><strong>Role:</strong> ${d.role || "—"} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Analysis:</strong> ${d.aiPowered ? "Groq LLaMA 3 AI" : "Smart Engine"}</p>
<div class="score-box"><div class="score-num">${d.score}/100</div></div>
<div class="meta">
  <div class="meta-cell"><strong>${d.jobMatchScore || 0}</strong><span>Job Match Score</span></div>
  <div class="meta-cell"><strong>${d.keywordMatchPct || 0}%</strong><span>Keyword Match</span></div>
  <div class="meta-cell"><strong>${d.wordCount || 0}</strong><span>Word Count</span></div>
  <div class="meta-cell"><strong>${d.extractedSkills?.length || 0}</strong><span>Skills Detected</span></div>
</div>
<h2>AI Assessment</h2><p>${d.summary || "—"}</p>
<h2>Recruiter View</h2><p><em>${d.recruiterView || "—"}</em></p>
<h2>Overall Verdict</h2><p>${d.overallVerdict || "—"}</p>
<h2>Strengths</h2>${(d.strengths||[]).map(s=>`<div class="item">✅ ${s}</div>`).join("")||"<p>—</p>"}
<h2>Weaknesses</h2>${(d.weaknesses||[]).map(w=>`<div class="item">⚠️ ${w}</div>`).join("")||"<p>—</p>"}
<h2>Keywords Found</h2><p>${(d.keywordsMatched||[]).map(k=>`<span class="chip">${k}</span>`).join("")||"None found"}</p>
<h2>Missing Keywords</h2><p>${(d.missingKeywords||[]).map(k=>`<span class="chip miss">${k}</span>`).join("")||"No gaps!"}</p>
<h2>AI Suggestions</h2>${(d.suggestions||[]).map(s=>`<div class="item">${s}</div>`).join("")||"<p>—</p>"}
<h2>Instant Rewrite</h2><p>${d.rewriteSuggestion || "—"}</p>
<h2>ATS Expert Tips</h2>${(d.atsTips||[]).map((t,i)=>`<div class="item"><strong>${i+1}.</strong> ${t}</div>`).join("")}
<h2>LinkedIn Optimization</h2>${(d.linkedInTips||[]).map(t=>`<div class="item">→ ${t}</div>`).join("")}
<hr style="margin-top:24px;border-color:#e0d9ff"/>
<p style="font-size:11px;color:#9a92b8;text-align:center;margin-top:10px">Generated by ResumeRank · AI-Powered ATS Analyzer · Free at resumerank.app</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "ResumeRank_Report.html"; a.click();
  URL.revokeObjectURL(url);
  toast("Report downloaded! Open in browser → Print → Save as PDF.", "success");
});

/* ═══════════════════════════════════════════
   12. RESET
═══════════════════════════════════════════ */
function fullReset() {
  selectedFile = null;
  fileInput.value = "";
  fileBar.style.display      = "none";
  dropZone.style.display     = "block";
  analyzeBtn.disabled        = true;
  analyzerCard.style.display = "block";
  loadingState.style.display = "none";
  resultsShell.style.display = "none";
  errorState.style.display   = "none";
  $("analyzer").scrollIntoView({ behavior: "smooth" });
}
$("resetBtn").addEventListener("click", fullReset);
$("errRetry").addEventListener("click", fullReset);

/* ═══════════════════════════════════════════
   13. LOCAL STORAGE — Recent Analysis
═══════════════════════════════════════════ */
const LS_KEY = "rr_last_result";

function saveToStorage(data) {
  try {
    const payload = { data, savedAt: new Date().toISOString(), role: jobRoleSelect.value };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (e) {
    // localStorage might be full or blocked — fail silently
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - new Date(parsed.savedAt).getTime() > 86400000) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function showRecentBanner() {
  const saved = loadFromStorage();
  if (!saved) return;
  const banner = $("recentBanner");
  const d = saved.data;
  const when = new Date(saved.savedAt).toLocaleString();
  $("rbSub").textContent = `Score: ${d.score}/100 · ${ROLE_LABELS[saved.role] || saved.role} · Saved ${when}`;
  banner.style.display = "block";

  $("rbLoad").addEventListener("click", () => {
    lastResult = d;
    // Restore role select
    if (saved.role) jobRoleSelect.value = saved.role;
    renderRolePills(saved.role);
    analyzerCard.style.display = "none";
    showResults(d);
    banner.style.display = "none";
    toast("Previous analysis loaded!", "success");
  });

  $("rbClose").addEventListener("click", () => {
    banner.style.display = "none";
    localStorage.removeItem(LS_KEY);
  });
}

// Show banner on page load if data exists
showRecentBanner();

/* ═══════════════════════════════════════════
   14. STATIC TIPS SLIDER (bottom section) — FIXED
═══════════════════════════════════════════ */
function buildTipDots() {
  tipsDots.innerHTML = "";
  for (let i = 0; i < TOTAL_TIPS; i++) {
    const d = document.createElement("div");
    d.className = "t-dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", () => goTip(i));
    tipsDots.appendChild(d);
  }
}

function goTip(idx) {
  currentTip = ((idx % TOTAL_TIPS) + TOTAL_TIPS) % TOTAL_TIPS;
  tipsTrack.style.transform = `translateX(-${currentTip * 100}%)`;
  document.querySelectorAll(".t-dot").forEach((d, i) => d.classList.toggle("active", i === currentTip));
}

function startTipsAuto() {
  clearInterval(tipsTimer);
  tipsTimer = setInterval(() => goTip(currentTip + 1), 4800);
}

$("tipsPrev").addEventListener("click", () => { clearInterval(tipsTimer); goTip(currentTip - 1); startTipsAuto(); });
$("tipsNext").addEventListener("click", () => { clearInterval(tipsTimer); goTip(currentTip + 1); startTipsAuto(); });

const tipsWrapEl = document.querySelector(".tips-wrap");
tipsWrapEl?.addEventListener("mouseenter", () => clearInterval(tipsTimer));
tipsWrapEl?.addEventListener("mouseleave", startTipsAuto);

// Touch swipe on tips
let tipsTouchX = 0;
tipsWrapEl?.addEventListener("touchstart", e => tipsTouchX = e.changedTouches[0].clientX, { passive: true });
tipsWrapEl?.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - tipsTouchX;
  if (Math.abs(dx) > 45) { clearInterval(tipsTimer); goTip(currentTip + (dx < 0 ? 1 : -1)); startTipsAuto(); }
});

buildTipDots();
startTipsAuto();

/* ═══════════════════════════════════════════
   15. UTILITIES
═══════════════════════════════════════════ */
function setEl(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function mkEl(tag, cls, text) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function renderChips(containerId, items, getProps) {
  const c = $(containerId); if (!c) return;
  c.innerHTML = "";
  items.forEach(item => {
    const { className, text } = getProps(item);
    c.appendChild(mkEl("span", className, text));
  });
}

/* Set metric bar: label text + bar width */
function setMetricBar(labelId, val, max, barId) {
  setEl(labelId, val || 0);
  setBarPct(barId, Math.round((val / max) * 100));
}

/* Set a bar fill width by percentage (clamped 0–100) */
function setBarPct(barId, pct) {
  const el = $(barId);
  if (el) setTimeout(() => { el.style.width = Math.min(100, Math.max(0, Math.round(pct))) + "%"; }, 300);
}

/* Animated number count-up */
function animNum(id, start, end, duration) {
  const el = $(id); if (!el) return;
  const startTime = performance.now();
  function step(now) {
    const p = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.round(start + (end - start) * easeOut(p));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Toast notification */
function toast(msg, type = "info") {
  document.querySelectorAll(".rr-toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "rr-toast";
  t.textContent = msg;
  t.setAttribute("role", "alert");
  const bg = type === "error" ? "#dc2626" : type === "success" ? "#059669" : "#7c3aed";
  t.style.background = bg;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}
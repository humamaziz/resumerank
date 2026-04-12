require("dotenv").config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
/* ═══════════════════════════════════════════════════════════════
   ResumeRank — server.js  (Production v3)
   AI-powered resume analysis using Groq (free LLaMA 3)
   ═══════════════════════════════════════════════════════════════
   HOW TO GET YOUR FREE API KEY:
   1. Go to https://console.groq.com/
   2. Sign up (free, no credit card needed)
   3. Create an API key
   4. Paste it below or set env variable: GROQ_API_KEY=your_key
   ═══════════════════════════════════════════════════════════════ */

const express  = require("express");
const multer   = require("multer");
const pdfParse = require("pdf-parse");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const https    = require("https");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ⚠️  PASTE YOUR FREE GROQ API KEY HERE
// Get free key at: https://console.groq.com/

// Groq model — fast, free, excellent quality
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── MULTER SETUP ─────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `resume_${Date.now()}_${file.originalname}`)
  }),
  fileFilter: (req, file, cb) => {
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF files are allowed."), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ═══════════════════════════════════════════════════════════════
//  ROLE DEFINITIONS — keywords per job role
// ═══════════════════════════════════════════════════════════════

const ROLE_KEYWORDS = {
  software_dev:     ["javascript","python","java","c++","git","sql","rest api","oop","docker","algorithms","data structures","agile","unit testing","debugging","linux"],
  frontend:         ["html","css","javascript","react","vue","angular","typescript","webpack","tailwind","responsive design","figma","accessibility","performance","rest api","git"],
  backend:          ["node.js","python","java","spring","django","flask","sql","mongodb","postgresql","redis","docker","kubernetes","rest api","graphql","microservices"],
  fullstack:        ["react","node.js","javascript","mongodb","sql","git","docker","typescript","rest api","html","css","express","authentication","deployment","agile"],
  data_science:     ["python","machine learning","sql","tensorflow","pandas","numpy","scikit-learn","data analysis","statistics","r","jupyter","deep learning","nlp","visualization","pytorch"],
  devops:           ["docker","kubernetes","aws","ci/cd","linux","terraform","jenkins","git","ansible","monitoring","bash","cloud","azure","gcp","infrastructure"],
  ui_ux:            ["figma","sketch","wireframing","user research","prototyping","adobe xd","usability testing","information architecture","design systems","css","accessibility","user flows","a/b testing","typography"],
  marketing:        ["seo","google analytics","content marketing","social media","ppc","crm","email marketing","hubspot","google ads","conversion optimization","kpi","branding","copywriting","market research"],
  product:          ["roadmap","user stories","agile","scrum","jira","analytics","stakeholder management","a/b testing","product strategy","market research","kpi","mvp","prioritization","sprint planning"],
  business_analyst: ["sql","excel","requirements gathering","jira","data analysis","reporting","agile","tableau","process modeling","stakeholder management","bpmn","erd","documentation","uml"],
};

const ROLE_LABELS = {
  software_dev: "Software Developer", frontend: "Frontend Developer",
  backend: "Backend Developer", fullstack: "Full Stack Developer",
  data_science: "Data Scientist", devops: "DevOps Engineer",
  ui_ux: "UI/UX Designer", marketing: "Digital Marketer",
  product: "Product Manager", business_analyst: "Business Analyst",
};

// ═══════════════════════════════════════════════════════════════
//  DEEP STATIC ANALYSIS ENGINE
//  Runs regardless of AI — gives rich structured data
// ═══════════════════════════════════════════════════════════════

function deepAnalyze(text, role) {
  const lower = text.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const roleKeywords = ROLE_KEYWORDS[role] || ROLE_KEYWORDS["software_dev"];

  // ── 1. SECTION DETECTION ──────────────────────────────────────────────────
  const sectionPatterns = {
    contact:    ["email","phone","mobile","linkedin","github","portfolio","address","contact"],
    summary:    ["summary","objective","profile","about me","about","overview","professional summary"],
    education:  ["education","degree","university","college","school","b.tech","bca","mca","bachelor","master","phd","graduation","cgpa","gpa","10th","12th"],
    skills:     ["skills","technical skills","technologies","competencies","expertise","tools","languages","frameworks","proficiencies"],
    experience: ["experience","work experience","employment","career","professional experience","work history"],
    projects:   ["projects","personal projects","academic projects","side projects","portfolio"],
    internship: ["internship","intern","trainee","apprentice"],
    achievements:["achievements","awards","honors","certifications","recognition","accomplishments"],
    extracurricular:["activities","volunteer","extracurricular","clubs","societies","sports","hobbies"],
  };

  const detectedSections = {};
  Object.entries(sectionPatterns).forEach(([section, patterns]) => {
    detectedSections[section] = patterns.some(p => lower.includes(p));
  });

  const foundSectionNames = Object.entries(detectedSections).filter(([,v]) => v).map(([k]) => k);
  const missingSectionNames = Object.entries(detectedSections).filter(([,v]) => !v).map(([k]) => k);

  // ── 2. KEYWORD MATCHING ───────────────────────────────────────────────────
  const foundKeywords    = roleKeywords.filter(kw => lower.includes(kw.toLowerCase()));
  const missingKeywords  = roleKeywords.filter(kw => !lower.includes(kw.toLowerCase()));
  const keywordMatchPct  = Math.round((foundKeywords.length / roleKeywords.length) * 100);

  // ── 3. GENERAL TECH SKILLS EXTRACTION ────────────────────────────────────
  const allTechTerms = [
    "javascript","python","java","c++","c#","go","rust","kotlin","swift","typescript",
    "react","vue","angular","svelte","next.js","nuxt","gatsby",
    "node.js","express","django","flask","spring","fastapi","laravel","rails",
    "html","css","sass","tailwind","bootstrap","materialui",
    "sql","mysql","postgresql","mongodb","redis","firebase","dynamodb","oracle",
    "git","github","gitlab","bitbucket","docker","kubernetes","terraform","ansible",
    "aws","azure","gcp","heroku","vercel","netlify","cloudflare",
    "tensorflow","pytorch","scikit-learn","pandas","numpy","matplotlib",
    "figma","adobe xd","sketch","photoshop","illustrator",
    "jira","confluence","notion","slack","trello","asana",
    "rest api","graphql","grpc","websocket","microservices","ci/cd","agile","scrum",
    "machine learning","deep learning","nlp","computer vision","data analysis",
    "linux","bash","powershell","vim","nginx","apache"
  ];
  const extractedSkills = [...new Set(allTechTerms.filter(t => lower.includes(t.toLowerCase())))];

  // ── 4. CONTACT INFO ───────────────────────────────────────────────────────
  const hasEmail    = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/.test(text);
  const hasPhone    = /(\+?\d[\d\s\-\(\)]{7,}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\/in\//i.test(text) || lower.includes("linkedin");
  const hasGitHub   = /github\.com\//i.test(text) || lower.includes("github");

  // ── 5. ACTION VERBS ───────────────────────────────────────────────────────
  const actionVerbs = [
    "developed","designed","implemented","built","created","managed","led","achieved",
    "improved","collaborated","deployed","analyzed","delivered","optimized","automated",
    "architected","engineered","reduced","increased","launched","maintained","integrated",
    "migrated","refactored","mentored","streamlined","established","coordinated"
  ];
  const foundActionVerbs = actionVerbs.filter(v => lower.includes(v));

  // ── 6. QUANTIFICATION CHECK ───────────────────────────────────────────────
  const quantPattern = /\d+[\+%xX]?\s*(users?|customers?|clients?|projects?|team|engineers?|million|thousand|k\b|%|percent|hours?|days?|weeks?|months?|years?|times?|x\b)/gi;
  const quantMatches = (text.match(quantPattern) || []);
  const hasQuantifiedAchievements = quantMatches.length > 0;

  // ── 7. FORMATTING SIGNALS ─────────────────────────────────────────────────
  const hasBulletPoints = /[•·▪▸\-\*]\s+\w/.test(text);
  const avgLineLength = lines.reduce((s, l) => s + l.length, 0) / (lines.length || 1);
  const formattingGood = hasBulletPoints && avgLineLength < 120;

  // ── 8. READABILITY SCORE (Flesch-Kincaid simplified) ─────────────────────
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const syllableCount = words.reduce((total, w) => {
    return total + Math.max(1, w.replace(/[^aeiou]/gi,"").length);
  }, 0);
  const avgSyllPerWord = syllableCount / (words.length || 1);
  const avgWordsPerSent = words.length / (sentences.length || 1);
  // Flesch Reading Ease (higher = easier to read, 60-70 is ideal for resumes)
  const fleschScore = Math.round(206.835 - 1.015 * avgWordsPerSent - 84.6 * avgSyllPerWord);
  const readabilityScore = Math.min(100, Math.max(0, fleschScore));

  // ── 9. ATS SCORE CALCULATION ──────────────────────────────────────────────
  let atsScore = 0;

  // Keyword match: 0-35 points
  atsScore += Math.round(keywordMatchPct * 0.35);

  // Section completeness: 0-25 points
  const criticalSections = ["education","skills","experience","contact"];
  const criticalFound = criticalSections.filter(s => detectedSections[s]).length;
  atsScore += Math.round((criticalFound / criticalSections.length) * 25);

  // Has projects/internship: +5
  if (detectedSections.projects || detectedSections.internship) atsScore += 5;

  // Word count score: 0-10 points
  if (wordCount >= 300 && wordCount <= 900) atsScore += 10;
  else if (wordCount >= 200 && wordCount <= 1100) atsScore += 6;
  else if (wordCount < 100) atsScore -= 10;

  // Contact completeness: 0-8 points
  if (hasEmail)    atsScore += 2;
  if (hasPhone)    atsScore += 2;
  if (hasLinkedIn) atsScore += 2;
  if (hasGitHub)   atsScore += 2;

  // Action verbs: 0-7 points
  atsScore += Math.min(7, foundActionVerbs.length);

  // Quantified achievements: +5
  if (hasQuantifiedAchievements) atsScore += 5;

  // Formatting: +5
  if (formattingGood) atsScore += 5;

  atsScore = Math.max(0, Math.min(100, Math.round(atsScore)));

  // ── 10. JOB MATCH SCORE ───────────────────────────────────────────────────
  // Weighted: keyword match (60%) + section completeness (40%)
  const jobMatchScore = Math.round(keywordMatchPct * 0.6 + (criticalFound / criticalSections.length) * 100 * 0.4);

  // ── 11. STRENGTHS (static, based on what's present) ──────────────────────
  const strengths = [];
  if (foundKeywords.length >= Math.ceil(roleKeywords.length * 0.5))
    strengths.push(`Strong keyword alignment — ${foundKeywords.length}/${roleKeywords.length} role keywords present`);
  if (foundSectionNames.length >= 5)
    strengths.push(`Comprehensive resume structure with ${foundSectionNames.length} sections detected`);
  if (hasQuantifiedAchievements)
    strengths.push(`${quantMatches.length} quantified achievement(s) found — this signals real impact`);
  if (foundActionVerbs.length >= 4)
    strengths.push(`Good use of ${foundActionVerbs.length} action verbs (${foundActionVerbs.slice(0,3).join(", ")}…)`);
  if (hasLinkedIn && hasGitHub)
    strengths.push("LinkedIn and GitHub profiles included — great for credibility");
  if (wordCount >= 300 && wordCount <= 700)
    strengths.push(`Optimal length (${wordCount} words) — concise and readable`);
  if (extractedSkills.length >= 8)
    strengths.push(`Diverse skill set — ${extractedSkills.length} technologies identified`);
  if (detectedSections.achievements)
    strengths.push("Achievements/certifications section adds extra credibility");
  if (strengths.length === 0)
    strengths.push("Resume submitted and parsed successfully");

  // ── 12. WEAKNESSES (static) ───────────────────────────────────────────────
  const weaknesses = [];
  if (missingKeywords.length > Math.ceil(roleKeywords.length * 0.5))
    weaknesses.push(`Missing ${missingKeywords.length} role-critical keywords — ATS will likely filter this out`);
  if (!detectedSections.summary)
    weaknesses.push("No professional summary/objective — ATS and recruiters look for this first");
  if (!hasQuantifiedAchievements)
    weaknesses.push("No quantified achievements — 'Improved performance' is weaker than 'Improved performance by 40%'");
  if (foundActionVerbs.length < 3)
    weaknesses.push("Weak use of action verbs — bullets should start with strong verbs like 'Built', 'Led', 'Reduced'");
  if (!hasGitHub && (role === "software_dev" || role === "frontend" || role === "fullstack" || role === "backend"))
    weaknesses.push("No GitHub profile link — essential for tech roles");
  if (wordCount < 250)
    weaknesses.push(`Resume is too short (${wordCount} words) — add more detail to experience and projects`);
  if (wordCount > 1000)
    weaknesses.push(`Resume is too long (${wordCount} words) — trim to 1 page for freshers, 2 pages max`);
  if (!detectedSections.projects && !detectedSections.internship)
    weaknesses.push("No projects or internship section — critical for entry-level candidates");
  if (weaknesses.length === 0)
    weaknesses.push("No major structural weaknesses found");

  // ── 13. STATIC ATS TIPS ───────────────────────────────────────────────────
  const atsTips = [
    "Use standard section headers like 'Work Experience', 'Education', 'Skills' — avoid creative names",
    "Mirror exact phrases from the job description — ATS matches keywords literally",
    "Submit as a plain PDF (not a scanned image) — ATS cannot read image-based resumes",
    "Avoid tables, columns, headers/footers — they break ATS parsing and lose data",
    "Put skills as plain text, not inside graphics, icons, or image-based skill bars",
    "Use full forms alongside abbreviations: 'React.js' not just 'React'",
    "Include the job title you're applying for in your summary section",
    "Quantify every achievement: numbers (%), timeframes, and team sizes increase relevance",
    "Save with a professional filename: FirstName_LastName_Resume.pdf",
    "LinkedIn URL on resume increases trust — ensure your profile matches your resume",
  ];

  // ── 14. LINKEDIN TIPS ─────────────────────────────────────────────────────
  const linkedInTips = [
    `Add '${ROLE_LABELS[role] || "Professional"}' as your LinkedIn headline — recruiters search by title`,
    "Your LinkedIn summary should be a 3-5 sentence story, not a list",
    "Request 3+ recommendations from colleagues, professors, or managers",
    "Endorse and get endorsed for at least 10 skills relevant to your role",
    "Enable 'Open to Work' with specific role preferences for recruiter visibility",
    "Publish or share 2 articles/posts per month — LinkedIn rewards active profiles",
    "Ensure your experience dates on LinkedIn exactly match your resume",
  ];

  // ── 15. TEXT PREVIEW (first 800 chars, cleaned) ───────────────────────────
  const textPreview = text.replace(/\s{3,}/g, "\n\n").trim().substring(0, 800);

  return {
    atsScore,
    jobMatchScore,
    keywordMatchPct,
    foundKeywords,
    missingKeywords: missingKeywords.slice(0, 8),
    top5MissingKeywords: missingKeywords.slice(0, 5),
    extractedSkills,
    detectedSections: foundSectionNames,
    missingSections:  missingSectionNames.filter(s => ["summary","education","skills","experience","projects","contact"].includes(s)),
    wordCount,
    hasEmail, hasPhone, hasLinkedIn, hasGitHub,
    foundActionVerbs,
    hasQuantifiedAchievements,
    quantMatches: quantMatches.slice(0, 5),
    readabilityScore,
    formattingGood,
    strengths:  strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    atsTips,
    linkedInTips,
    textPreview,
    role: ROLE_LABELS[role] || role,
  };
}

// ═══════════════════════════════════════════════════════════════
//  AI ANALYSIS via GROQ (free LLaMA 3)
// ═══════════════════════════════════════════════════════════════

function callGroqAPI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
      temperature: 0.4,
    });

    const options = {
      hostname: "api.groq.com",
      path:     "/openai/v1/chat/completions",
      method:   "POST",
      headers:  {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || "Groq API error"));
          const content = parsed.choices?.[0]?.message?.content || "";
          resolve(content);
        } catch (e) {
          reject(new Error("Failed to parse Groq response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error("AI request timed out")); });
    req.write(body);
    req.end();
  });
}

// Build a structured prompt for the AI
function buildAIPrompt(resumeText, analysis, role) {
  const roleName = ROLE_LABELS[role] || role;
  const snippet  = resumeText.substring(0, 2000); // send first 2000 chars to avoid token limits

  return `You are an expert ATS resume coach and ${roleName} recruiter with 15 years of experience.

Analyze this resume for a ${roleName} position and respond ONLY with a valid JSON object. No markdown, no explanation, just raw JSON.

RESUME CONTENT:
---
${snippet}
---

STATIC ANALYSIS ALREADY DONE:
- ATS Score: ${analysis.atsScore}/100
- Keywords found: ${analysis.foundKeywords.join(", ") || "none"}
- Missing keywords: ${analysis.missingKeywords.join(", ") || "none"}
- Sections detected: ${analysis.detectedSections.join(", ")}
- Word count: ${analysis.wordCount}

Return this exact JSON structure (all fields are required):
{
  "summary": "2-3 sentence professional assessment of this resume for a ${roleName} role",
  "aiStrengths": ["strength 1", "strength 2", "strength 3"],
  "aiWeaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "aiSuggestions": [
    "Specific actionable suggestion 1 with example",
    "Specific actionable suggestion 2 with example",
    "Specific actionable suggestion 3 with example",
    "Specific actionable suggestion 4 with example",
    "Specific actionable suggestion 5 with example"
  ],
  "rewriteSuggestion": "Example: rewrite one weak bullet point from the resume into a strong, quantified version. Format: BEFORE: [original] → AFTER: [improved]",
  "recruiterView": "What a recruiter would think in the first 10 seconds of scanning this resume",
  "overallVerdict": "one word: Excellent / Good / Average / Weak"
}`;
}

// Parse AI JSON response safely
function parseAIResponse(text) {
  try {
    // Try direct parse
    return JSON.parse(text.trim());
  } catch {
    // Extract JSON from within markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    // Find first { ... } block
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  res.json({ message: "ResumeRank API v3 — AI-Powered", status: "OK", version: "3.0" });
});

// ── POST /analyze ─────────────────────────────────────────────────────────────
app.post("/analyze", upload.single("resume"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Please upload a PDF resume." });
  }

  const filePath = req.file.path;
  const role = req.body.role || "software_dev"; // Role sent from frontend

  try {
    // ── STEP 1: Extract text from PDF ────────────────────────────────────────
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData   = await pdfParse(pdfBuffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length < 30) {
      return res.status(422).json({
        error: "Could not extract text from PDF. Please use a text-based PDF, not a scanned image."
      });
    }

    // ── STEP 2: Deep static analysis ─────────────────────────────────────────
    const analysis = deepAnalyze(resumeText, role);

    // ── STEP 3: AI analysis (with graceful fallback) ──────────────────────────
    let aiData = null;
    const aiAvailable = GROQ_API_KEY && GROQ_API_KEY !== "YOUR_GROQ_API_KEY_HERE";

    if (aiAvailable) {
      try {
        const prompt   = buildAIPrompt(resumeText, analysis, role);
        const aiText   = await callGroqAPI(prompt);
        aiData = parseAIResponse(aiText);
        if (aiData) console.log("✅ AI analysis successful");
      } catch (aiErr) {
        console.warn("⚠️  AI analysis failed (using static fallback):", aiErr.message);
        aiData = null;
      }
    } else {
      console.log("ℹ️  No API key set — using intelligent static analysis");
    }

    // ── STEP 4: Merge AI + static into final response ─────────────────────────
    const response = {
      // Core scores
      score:         analysis.atsScore,
      jobMatchScore: analysis.jobMatchScore,
      keywordMatchPct: analysis.keywordMatchPct,

      // Keywords
      keywordsMatched:    analysis.foundKeywords,
      missingKeywords:    analysis.missingKeywords,
      top5Missing:        analysis.top5MissingKeywords,
      extractedSkills:    analysis.extractedSkills,

      // Structure
      detectedSections: analysis.detectedSections,
      missingSections:  analysis.missingSections,

      // Resume metadata
      wordCount:               analysis.wordCount,
      readabilityScore:        analysis.readabilityScore,
      hasQuantifiedAchievements: analysis.hasQuantifiedAchievements,
      quantExamples:           analysis.quantMatches,
      foundActionVerbs:        analysis.foundActionVerbs,
      formattingGood:          analysis.formattingGood,
      contact: {
        hasEmail:    analysis.hasEmail,
        hasPhone:    analysis.hasPhone,
        hasLinkedIn: analysis.hasLinkedIn,
        hasGitHub:   analysis.hasGitHub,
      },

      // Analysis content — AI if available, otherwise static
      summary:       aiData?.summary        || `This resume has been analyzed for a ${analysis.role} position. It scores ${analysis.atsScore}/100 on ATS compatibility with ${analysis.keywordMatchPct}% keyword match. ${analysis.strengths[0] || "See detailed feedback below."} ${analysis.weaknesses[0] ? `Primary concern: ${analysis.weaknesses[0]}` : ""}`,
      strengths:     aiData?.aiStrengths    || analysis.strengths,
      weaknesses:    aiData?.aiWeaknesses   || analysis.weaknesses,
      suggestions:   aiData?.aiSuggestions  || generateSuggestions(analysis, role),
      rewriteSuggestion: aiData?.rewriteSuggestion || generateRewriteHint(analysis),
      recruiterView:     aiData?.recruiterView     || generateRecruiterView(analysis),
      overallVerdict:    aiData?.overallVerdict    || getVerdict(analysis.atsScore),

      // Static expert content
      atsTips:      analysis.atsTips,
      linkedInTips: analysis.linkedInTips,

      // Preview
      textPreview: analysis.textPreview,

      // Meta
      role:       analysis.role,
      aiPowered:  !!aiData,
    };

    res.json(response);

  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ error: "Failed to analyze resume. Please try again with a different PDF." });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ═══════════════════════════════════════════════════════════════
//  STATIC FALLBACK GENERATORS
//  Used when AI key is not set
// ═══════════════════════════════════════════════════════════════

function generateSuggestions(a, role) {
  const sug = [];
  if (a.missingKeywords.length > 0)
    sug.push(`Add these role-critical keywords to your Skills section: ${a.missingKeywords.slice(0,4).join(", ")}`);
  if (!a.detectedSections.includes("summary"))
    sug.push(`Add a 3-sentence Professional Summary at the top: Who you are → Your top skill → Your goal`);
  if (!a.hasQuantifiedAchievements)
    sug.push(`Quantify your achievements. Example: "Built a web app" → "Built a web app serving 500+ daily users"`);
  if (a.foundActionVerbs.length < 4)
    sug.push(`Start every bullet point with a strong action verb: Built, Designed, Reduced, Increased, Delivered`);
  if (!a.hasGitHub && ["software_dev","frontend","backend","fullstack"].includes(role))
    sug.push(`Add your GitHub profile URL. Include 2-3 pinned projects relevant to ${ROLE_LABELS[role]}`);
  if (a.missingSections.includes("projects"))
    sug.push(`Add a Projects section with 2-3 relevant projects. Include tech stack, your role, and impact`);
  if (a.wordCount < 300)
    sug.push(`Expand your resume to at least 300-500 words. Add more detail about your projects and responsibilities`);
  sug.push(`Tailor this resume specifically for each job application by matching keywords from the job posting`);
  return sug.slice(0, 5);
}

function generateRewriteHint(a) {
  if (a.hasQuantifiedAchievements) {
    return `BEFORE: "Worked on backend development" → AFTER: "Engineered RESTful APIs handling 10K+ requests/day, reducing response time by 35% using Node.js and Redis caching"`;
  }
  return `BEFORE: "Developed a website for the college fest" → AFTER: "Designed and deployed a responsive event management website using React.js and Firebase, serving 800+ registrations"`;
}

function generateRecruiterView(a) {
  if (a.atsScore >= 75) return "Strong first impression. Likely to pass ATS filters and get human review. Keyword alignment is solid.";
  if (a.atsScore >= 50) return "Has potential but would be filtered out by strict ATS. Recruiter would see gaps in keywords and sections.";
  return "High risk of ATS rejection. A recruiter would notice missing sections and low keyword relevance immediately.";
}

function getVerdict(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Average";
  return "Weak";
}

// ─── MULTER ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err)
    return res.status(400).json({ error: err.message });
  next();
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ResumeRank v3 running at http://localhost:${PORT}`);
  console.log(`📊 POST /analyze — AI-powered resume analysis`);
  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    console.log(`\n⚠️  AI DISABLED: Set GROQ_API_KEY for full AI mode`);
    console.log(`   Free key at: https://console.groq.com/\n`);
  } else {
    console.log(`\n✅ AI ENABLED: Groq LLaMA 3 (${GROQ_MODEL})\n`);
  }
});
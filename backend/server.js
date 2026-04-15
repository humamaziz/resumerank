require("dotenv").config();
/* ═══════════════════════════════════════════════════════
   ResumeRank v5 — server.js
   Universal job support · Real counter · Clean AI output
   Run: node server.js
   Env: GROQ_API_KEY=your_key  (free at console.groq.com)
═══════════════════════════════════════════════════════ */

const express  = require("express");
const multer   = require("multer");
const pdfParse = require("pdf-parse");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const https    = require("https");

const app  = express();
const PORT = process.env.PORT || 5000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const COUNTER_FILE = path.join(__dirname, "counter.json");

// ── Serve frontend ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(cors());
app.use(express.json());

// ── Multer ───────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `resume_${Date.now()}.pdf`),
  }),
  fileFilter: (req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("PDF only"), false),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Analysis Counter ─────────────────────────────────────────────
function readCounter() {
  try { return JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8")).count || 0; } catch { return 0; }
}
function incrementCounter() {
  const count = readCounter() + 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count }));
  return count;
}

// ═══════════════════════════════════════════════════════
//  UNIVERSAL ROLE TAXONOMY
// ═══════════════════════════════════════════════════════

const CATEGORIES = {
  technology: {
    label: "Technology",
    roles: {
      software_dev:  "Software Developer",
      frontend:      "Frontend Developer",
      backend:       "Backend Developer",
      fullstack:     "Full Stack Developer",
      data_science:  "Data Scientist",
      devops:        "DevOps Engineer",
      mobile_dev:    "Mobile Developer",
      qa_engineer:   "QA / Test Engineer",
      cybersecurity: "Cybersecurity Analyst",
      ai_ml:         "AI / ML Engineer",
    },
  },
  management: {
    label: "Management",
    roles: {
      hr_manager:      "HR Manager",
      operations_mgr:  "Operations Manager",
      business_analyst:"Business Analyst",
      project_manager: "Project Manager",
      product_manager: "Product Manager",
      supply_chain:    "Supply Chain Manager",
    },
  },
  marketing: {
    label: "Marketing & Sales",
    roles: {
      digital_marketing: "Digital Marketer",
      seo_specialist:    "SEO Specialist",
      content_writer:    "Content Writer",
      brand_manager:     "Brand Manager",
      sales_executive:   "Sales Executive",
      social_media_mgr:  "Social Media Manager",
    },
  },
  finance: {
    label: "Finance & Accounting",
    roles: {
      accountant:         "Accountant",
      financial_analyst:  "Financial Analyst",
      investment_analyst: "Investment Analyst",
      auditor:            "Auditor",
      tax_consultant:     "Tax Consultant",
      ca:                 "Chartered Accountant",
    },
  },
  teaching: {
    label: "Teaching / Education",
    roles: {
      school_teacher:  "School Teacher",
      professor:       "Professor",
      lecturer:        "Lecturer",
      tutor:           "Private Tutor",
      trainer:         "Corporate Trainer",
      curriculum_dev:  "Curriculum Developer",
    },
  },
  healthcare: {
    label: "Healthcare",
    roles: {
      doctor:       "Doctor / Physician",
      nurse:        "Nurse",
      pharmacist:   "Pharmacist",
      lab_technician:"Lab Technician",
      physiotherapist:"Physiotherapist",
      health_admin: "Healthcare Administrator",
    },
  },
  law: {
    label: "Law & Legal",
    roles: {
      lawyer:          "Lawyer / Advocate",
      legal_analyst:   "Legal Analyst",
      paralegal:       "Paralegal",
      compliance_officer:"Compliance Officer",
      corporate_counsel: "Corporate Counsel",
    },
  },
  design: {
    label: "Design & Creative",
    roles: {
      ui_ux:          "UI/UX Designer",
      graphic_designer:"Graphic Designer",
      motion_designer: "Motion Designer",
      product_designer:"Product Designer",
      interior_designer:"Interior Designer",
      fashion_designer: "Fashion Designer",
    },
  },
  research: {
    label: "Research / PhD",
    roles: {
      research_scientist:"Research Scientist",
      phd_candidate:     "PhD Candidate",
      data_analyst:      "Data Analyst",
      policy_analyst:    "Policy Analyst",
      lab_researcher:    "Lab Researcher",
    },
  },
  others: {
    label: "Others",
    roles: {
      civil_engineer:   "Civil Engineer",
      mechanical_engineer:"Mechanical Engineer",
      journalist:       "Journalist / Reporter",
      event_manager:    "Event Manager",
      logistics:        "Logistics Coordinator",
      customer_support: "Customer Support Executive",
    },
  },
};

// ═══════════════════════════════════════════════════════
//  KEYWORD SETS — per role (deduplicated arrays)
// ═══════════════════════════════════════════════════════

const ROLE_KEYWORDS = {
  // Technology
  software_dev:    ["javascript","python","java","c++","git","sql","rest api","oop","docker","algorithms","data structures","agile","unit testing","linux","design patterns"],
  frontend:        ["html","css","javascript","react","typescript","webpack","tailwind","responsive design","figma","accessibility","performance","git","vue","angular","web vitals"],
  backend:         ["node.js","python","java","spring","sql","mongodb","postgresql","redis","docker","rest api","graphql","microservices","authentication","caching","message queues"],
  fullstack:       ["react","node.js","javascript","mongodb","sql","docker","typescript","rest api","html","css","express","authentication","ci/cd","deployment","agile"],
  data_science:    ["python","machine learning","sql","tensorflow","pandas","numpy","scikit-learn","statistics","r","jupyter","deep learning","nlp","data visualization","pytorch","feature engineering"],
  devops:          ["docker","kubernetes","aws","ci/cd","linux","terraform","jenkins","git","ansible","monitoring","bash","azure","gcp","infrastructure as code","helm"],
  mobile_dev:      ["react native","flutter","swift","kotlin","ios","android","xcode","firebase","rest api","mobile ui","push notifications","app store","play store","offline sync","typescript"],
  qa_engineer:     ["selenium","test automation","jira","api testing","postman","pytest","junit","test planning","regression testing","bug reporting","agile","performance testing","cypress","sql","ci/cd"],
  cybersecurity:   ["penetration testing","network security","firewalls","siem","vulnerability assessment","owasp","ethical hacking","iam","encryption","incident response","linux","python","nessus","compliance","threat analysis"],
  ai_ml:           ["machine learning","deep learning","python","tensorflow","pytorch","nlp","computer vision","model deployment","transformers","reinforcement learning","data pipeline","mlops","hugging face","llm","fine-tuning"],

  // Management
  hr_manager:      ["recruitment","talent acquisition","employee relations","performance management","hris","onboarding","compensation","benefits","hr policies","compliance","training","payroll","succession planning","labor law","organizational development"],
  operations_mgr:  ["process improvement","supply chain","budgeting","kpi","lean","six sigma","vendor management","logistics","cross-functional","project management","erp","strategic planning","cost reduction","team leadership","operations"],
  business_analyst:["requirements gathering","sql","jira","tableau","process modeling","stakeholder management","bpmn","uml","agile","data analysis","excel","business intelligence","gap analysis","user stories","reporting"],
  project_manager: ["pmp","agile","scrum","risk management","jira","stakeholder communication","budget management","milestone tracking","resource allocation","gantt","change management","prince2","kanban","deliverables","team leadership"],
  product_manager: ["product roadmap","user stories","agile","scrum","a/b testing","product strategy","market research","kpi","mvp","prioritization","sprint planning","go-to-market","user research","competitive analysis","analytics"],
  supply_chain:    ["logistics","procurement","inventory management","erp","vendor management","forecasting","lean","six sigma","supply chain optimization","demand planning","warehouse","supplier negotiation","kpi","cost reduction","sap"],

  // Marketing
  digital_marketing:["seo","google analytics","content marketing","social media","ppc","crm","email marketing","hubspot","google ads","conversion optimization","kpi","branding","copywriting","meta ads","marketing automation"],
  seo_specialist:   ["on-page seo","off-page seo","keyword research","google search console","backlinks","technical seo","content strategy","google analytics","semrush","ahrefs","site audit","schema markup","core web vitals","local seo","serp"],
  content_writer:   ["copywriting","seo writing","content strategy","editorial","blogging","social media content","proofreading","content management","wordpress","keyword research","brand voice","storytelling","email newsletters","long-form content","research"],
  brand_manager:    ["brand strategy","market research","brand identity","campaign management","consumer insights","competitive analysis","positioning","brand equity","integrated marketing","budget management","creative direction","kpi","brand guidelines","social media","pr"],
  sales_executive:  ["b2b sales","crm","lead generation","salesforce","pipeline management","negotiation","cold calling","relationship management","quota attainment","account management","upselling","customer retention","sales strategy","presentation skills","revenue growth"],
  social_media_mgr: ["instagram","facebook","twitter","linkedin","content calendar","analytics","engagement","paid social","influencer marketing","tiktok","community management","brand voice","hootsuite","social listening","campaign management"],

  // Finance
  accountant:          ["tally","gst","tds","financial statements","accounts payable","accounts receivable","tax compliance","audit","excel","budgeting","bank reconciliation","payroll","journal entries","financial reporting","erp"],
  financial_analyst:   ["financial modeling","excel","python","bloomberg","valuation","dcf","forecasting","budget analysis","variance analysis","sql","power bi","investment analysis","risk assessment","financial reporting","tableau"],
  investment_analyst:  ["equity research","dcf","financial modeling","bloomberg","portfolio management","valuation","fixed income","derivatives","risk analysis","excel","cfa","market analysis","investment thesis","due diligence","sector research"],
  auditor:             ["audit planning","internal controls","sox compliance","financial statements","risk assessment","gaap","ifrs","excel","analytical review","audit sampling","fraud detection","regulatory compliance","working papers","documentation","reporting"],
  tax_consultant:      ["income tax","gst","tax planning","tds","tax compliance","direct tax","indirect tax","income tax act","tax returns","transfer pricing","tax advisory","corporate tax","excel","financial analysis","regulatory compliance"],
  ca:                  ["ifrs","gaap","financial reporting","audit","taxation","gst","excel","erp","financial analysis","corporate law","investment advisory","risk management","compliance","due diligence","tally"],

  // Teaching
  school_teacher:  ["lesson planning","curriculum design","classroom management","differentiated instruction","assessment","student engagement","ncert","cbse","pedagogy","educational technology","parent communication","mentoring","subject expertise","learning outcomes","google classroom"],
  professor:       ["research","publications","curriculum development","academic writing","grant writing","thesis supervision","lecture delivery","course design","academic advising","interdisciplinary","peer review","conference presentations","lab management","scholarly research","mentoring"],
  lecturer:        ["lecture delivery","course design","student assessment","academic research","curriculum","higher education","subject matter expertise","lesson planning","e-learning","student mentoring","examination","academic writing","teaching methodology","lms","feedback"],
  tutor:           ["subject expertise","lesson planning","individualized instruction","student assessment","patience","communication","academic support","progress tracking","problem-solving","curriculum alignment","online tutoring","adaptability","exam preparation","goal setting","feedback"],
  trainer:         ["training delivery","instructional design","adult learning","lms","facilitation","needs assessment","content development","e-learning","performance improvement","measurement","stakeholder management","curriculum design","coaching","feedback","virtual training"],
  curriculum_dev:  ["curriculum design","instructional design","bloom's taxonomy","learning objectives","content development","assessment design","standards alignment","lms","educational technology","addie model","subject expertise","e-learning","stakeholder collaboration","evaluation","revision"],

  // Healthcare
  doctor:          ["clinical diagnosis","patient care","medical history","treatment planning","icd-10","emr","evidence-based medicine","pharmacology","differential diagnosis","patient communication","medical ethics","surgery","clinical research","public health","telemedicine"],
  nurse:           ["patient assessment","medication administration","iv therapy","wound care","vital signs","emr","patient education","infection control","emergency care","care planning","documentation","teamwork","critical thinking","compassion","triage"],
  pharmacist:      ["dispensing","drug interactions","clinical pharmacy","patient counseling","formulary management","pharmaceutical calculations","regulatory compliance","inventory management","clinical trials","pharmacovigilance","hospital pharmacy","retail pharmacy","patient safety","drug therapy management","documentation"],
  lab_technician:  ["sample collection","laboratory techniques","pcr","microscopy","quality control","equipment calibration","lab safety","data recording","nabl","specimen processing","biochemistry","hematology","microbiology","report generation","sop compliance"],
  physiotherapist: ["patient assessment","exercise therapy","manual therapy","rehabilitation","musculoskeletal","neurological physiotherapy","sports injury","patient education","goal setting","pain management","electrotherapy","posture correction","functional assessment","documentation","team collaboration"],
  health_admin:    ["healthcare management","billing","coding","compliance","hipaa","emr","operations management","staff management","patient satisfaction","budgeting","quality improvement","regulatory compliance","scheduling","vendor management","strategic planning"],

  // Law
  lawyer:            ["litigation","legal research","contract drafting","client representation","court appearances","legal writing","negotiation","case management","due diligence","legal compliance","ipc","crpc","civil procedure","criminal law","bar council"],
  legal_analyst:     ["legal research","contract analysis","regulatory compliance","due diligence","legal documentation","case analysis","risk assessment","drafting","litigation support","corporate law","intellectual property","legal writing","research tools","statutory interpretation","compliance"],
  paralegal:         ["legal research","case management","document preparation","filing","client communication","discovery","trial preparation","legal databases","contract review","scheduling","billing","legal correspondence","court procedures","document organization","confidentiality"],
  compliance_officer:["regulatory compliance","risk management","policy development","audit","sox","aml","kyc","training","legal knowledge","reporting","governance","data privacy","gdpr","internal controls","monitoring"],
  corporate_counsel: ["contract negotiation","mergers acquisitions","corporate governance","intellectual property","regulatory compliance","legal strategy","risk management","litigation management","employment law","securities law","due diligence","board reporting","legal documentation","negotiations","dispute resolution"],

  // Design
  ui_ux:           ["figma","sketch","wireframing","user research","prototyping","adobe xd","usability testing","information architecture","design systems","css","accessibility","user flows","a/b testing","typography","interaction design"],
  graphic_designer:["adobe photoshop","adobe illustrator","indesign","typography","branding","layout design","print design","color theory","logo design","packaging","digital design","creative direction","vector graphics","photo editing","brand identity"],
  motion_designer: ["after effects","cinema 4d","blender","motion graphics","animation","video editing","premiere pro","storyboarding","visual effects","3d animation","ui animation","explainer videos","brand animation","compositing","creative direction"],
  product_designer:["figma","user research","prototyping","design systems","usability testing","information architecture","visual design","interaction design","accessibility","design thinking","cross-functional collaboration","product strategy","wireframing","user flows","analytics"],
  interior_designer:["space planning","autocad","sketchup","3d rendering","material selection","client consultation","project management","building codes","furniture specification","color theory","lighting design","revit","mood boards","concept development","construction documents"],
  fashion_designer: ["garment construction","pattern making","draping","fashion illustration","textiles","trend forecasting","cad","collection development","production management","fashion marketing","sustainability","sourcing","fit sessions","portfolio","brand development"],

  // Research
  research_scientist:["scientific research","data analysis","statistical methods","publications","grant writing","laboratory techniques","r","python","experimental design","peer review","scientific writing","hypothesis testing","research methodology","conference presentations","interdisciplinary"],
  phd_candidate:     ["research methodology","academic writing","literature review","data analysis","thesis","conference presentations","statistical analysis","grant applications","r","python","peer review","experimental design","interdisciplinary research","teaching assistant","academic publishing"],
  data_analyst:      ["sql","python","excel","tableau","power bi","data cleaning","statistical analysis","reporting","data visualization","business intelligence","r","etl","dashboard creation","stakeholder communication","analytical thinking"],
  policy_analyst:    ["policy research","qualitative analysis","quantitative analysis","stakeholder engagement","report writing","regulatory analysis","legislative analysis","data analysis","program evaluation","government relations","policy development","economic analysis","excel","spss","advocacy"],
  lab_researcher:    ["experimental design","laboratory techniques","data collection","statistical analysis","scientific writing","literature review","microscopy","pcr","spectroscopy","quality control","equipment calibration","research protocols","data interpretation","teamwork","documentation"],

  // Others
  civil_engineer:      ["autocad","structural design","project management","site supervision","concrete design","revit","construction management","tender documentation","quantity surveying","building codes","estimation","civil drawing","staad pro","soil mechanics","highway design"],
  mechanical_engineer: ["autocad","solidworks","catia","finite element analysis","thermodynamics","fluid mechanics","manufacturing processes","project management","quality control","maintenance","cad/cam","product design","material science","lean manufacturing","simulation"],
  journalist:          ["reporting","news writing","editing","investigative journalism","interviewing","press freedom","digital journalism","social media","multimedia","fact-checking","storytelling","deadline management","source development","cms","broadcast journalism"],
  event_manager:       ["event planning","vendor management","budget management","logistics","client communication","on-site coordination","marketing","social media","project management","catering management","audio visual","team leadership","post-event reporting","sponsorship","timeline management"],
  logistics:           ["supply chain","transportation management","warehouse operations","inventory management","erp","fleet management","import export","customs clearance","vendor coordination","route optimization","sap","excel","freight management","documentation","cost reduction"],
  customer_support:    ["crm","customer service","issue resolution","zendesk","communication","empathy","product knowledge","escalation handling","sla","ticketing systems","data entry","active listening","team collaboration","feedback handling","kpi"],
};

// ═══════════════════════════════════════════════════════
//  DEEP ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════

function deepAnalyze(text, role) {
  const lower = text.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const roleKeywords = ROLE_KEYWORDS[role] || ROLE_KEYWORDS["software_dev"];

  // Section detection
  const sectionMap = {
    contact:        ["email","phone","mobile","linkedin","github","portfolio","address"],
    summary:        ["summary","objective","profile","about me","overview","professional summary","career objective"],
    education:      ["education","degree","university","college","school","b.tech","bca","mca","bachelor","master","phd","graduation","cgpa","gpa"],
    skills:         ["skills","technical skills","technologies","competencies","expertise","tools","key skills","core competencies"],
    experience:     ["experience","work experience","employment","professional experience","work history","career history"],
    projects:       ["projects","personal projects","academic projects","side projects","portfolio","key projects"],
    internship:     ["internship","intern","trainee","apprentice"],
    achievements:   ["achievements","awards","honors","certifications","recognition","accomplishments","publications","patents"],
    extracurricular:["activities","volunteer","extracurricular","clubs","sports","hobbies","interests"],
  };

  const detected = {};
  Object.entries(sectionMap).forEach(([s, pats]) => {
    detected[s] = pats.some(p => lower.includes(p));
  });
  const foundSections  = Object.entries(detected).filter(([,v]) => v).map(([k]) => k);
  const missingSections = ["summary","education","skills","experience","projects","contact"]
    .filter(s => !detected[s]);

  // Keywords (deduplicated)
  const foundKeywords   = [...new Set(roleKeywords.filter(kw => lower.includes(kw)))];
  const missingKeywords = [...new Set(roleKeywords.filter(kw => !lower.includes(kw)))];
  const kwMatchPct      = Math.round((foundKeywords.length / roleKeywords.length) * 100);

  // Broad skills extraction (used for Resume Builder)
  const allTerms = [
    "javascript","python","java","c++","c#","typescript","go","rust","kotlin","swift","php","ruby",
    "react","vue","angular","svelte","next.js","flutter","react native",
    "node.js","express","django","flask","spring","fastapi","laravel",
    "html","css","sass","tailwind","bootstrap",
    "sql","mysql","postgresql","mongodb","redis","firebase","dynamodb",
    "git","docker","kubernetes","terraform","ansible","aws","azure","gcp",
    "tensorflow","pytorch","scikit-learn","pandas","numpy",
    "figma","adobe xd","sketch","photoshop","illustrator","after effects",
    "jira","confluence","notion","trello","asana","slack",
    "machine learning","deep learning","nlp","data analysis","statistics",
    "linux","bash","nginx","rest api","graphql","microservices","agile","scrum",
    "excel","tableau","power bi","sap","tally","autocad","solidworks",
    "seo","google analytics","crm","salesforce","hubspot","mailchimp",
    "pmp","six sigma","lean","kaizen",
  ];
  const extractedSkills = [...new Set(allTerms.filter(t => lower.includes(t)))];

  // Contact
  const hasEmail    = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.test(text);
  const hasPhone    = /(\+?\d[\d\s\-()]{7,}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\/in\//i.test(text) || lower.includes("linkedin");
  const hasGitHub   = /github\.com\//i.test(text) || lower.includes("github");

  // Action verbs
  const verbs = ["developed","designed","implemented","built","created","managed","led","achieved","improved",
    "collaborated","deployed","analyzed","delivered","optimized","automated","architected","engineered",
    "reduced","increased","launched","maintained","integrated","migrated","refactored","mentored",
    "streamlined","established","coordinated","initiated","facilitated","conducted","administered"];
  const foundVerbs = [...new Set(verbs.filter(v => lower.includes(v)))];

  // Quantification
  const quantRx = /\d+[\+%]?\s*(users?|clients?|students?|patients?|cases?|projects?|team|engineers?|employees?|%|million|thousand|k\b|years?|months?|days?|hours?)/gi;
  const quantMatches = [...new Set(text.match(quantRx) || [])];
  const hasQuant = quantMatches.length > 0;

  // Formatting
  const hasBullets  = /[•·▪▸\-\*]\s+\w/.test(text);
  const avgLinelen  = lines.reduce((s,l) => s + l.length, 0) / (lines.length || 1);
  const formattingGood = hasBullets && avgLinelen < 120;

  // Readability
  const sentences   = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const syllables   = words.reduce((t,w) => t + Math.max(1, w.replace(/[^aeiou]/gi,"").length), 0);
  const flesch      = Math.round(206.835 - 1.015*(words.length/(sentences.length||1)) - 84.6*(syllables/(words.length||1)));
  const readability = Math.min(100, Math.max(0, flesch));

  // ATS Score
  let ats = 0;
  ats += Math.round(kwMatchPct * 0.35);
  const criticals   = ["education","skills","experience","contact"];
  const critFound   = criticals.filter(s => detected[s]).length;
  ats += Math.round((critFound / criticals.length) * 25);
  if (detected.projects || detected.internship) ats += 5;
  if (wordCount >= 300 && wordCount <= 900) ats += 10;
  else if (wordCount >= 200) ats += 5;
  else if (wordCount < 100) ats -= 10;
  if (hasEmail)    ats += 2;
  if (hasPhone)    ats += 2;
  if (hasLinkedIn) ats += 2;
  if (hasGitHub)   ats += 2;
  ats += Math.min(7, foundVerbs.length);
  if (hasQuant)    ats += 5;
  if (formattingGood) ats += 5;
  ats = Math.max(0, Math.min(100, Math.round(ats)));

  const jobMatch = Math.round(kwMatchPct * 0.6 + (critFound / criticals.length) * 100 * 0.4);

  // Strengths (unique, no duplication)
  const strengths = [];
  const strengthsSeen = new Set();
  const addS = (s) => { if (!strengthsSeen.has(s)) { strengthsSeen.add(s); strengths.push(s); } };
  if (foundKeywords.length >= Math.ceil(roleKeywords.length * 0.5))
    addS(`Strong keyword alignment — ${foundKeywords.length}/${roleKeywords.length} role keywords present`);
  if (foundSections.length >= 5)
    addS(`Comprehensive structure with ${foundSections.length} resume sections detected`);
  if (hasQuant && quantMatches.length > 0)
    addS(`${quantMatches.length} quantified achievement(s) found — demonstrates measurable impact`);
  if (foundVerbs.length >= 4)
    addS(`Effective use of action verbs (${foundVerbs.slice(0,3).join(", ")}…)`);
  if (hasLinkedIn && hasGitHub)
    addS("LinkedIn and GitHub both present — strong professional online presence");
  else if (hasLinkedIn)
    addS("LinkedIn profile included — adds recruiter trust");
  if (wordCount >= 300 && wordCount <= 750)
    addS(`Optimal resume length (${wordCount} words) — concise and readable`);
  if (extractedSkills.length >= 8)
    addS(`Diverse skill set with ${extractedSkills.length} recognised technologies/tools`);
  if (detected.achievements)
    addS("Certifications/awards section boosts credibility with ATS and recruiters");
  if (strengths.length === 0) addS("Resume successfully parsed and analyzed");

  // Weaknesses (unique)
  const weaknesses = [];
  const weakSeen = new Set();
  const addW = (w) => { if (!weakSeen.has(w)) { weakSeen.add(w); weaknesses.push(w); } };
  if (missingKeywords.length > Math.ceil(roleKeywords.length * 0.5))
    addW(`Missing ${missingKeywords.length} role-critical keywords — high ATS filter risk`);
  if (!detected.summary)
    addW("No professional summary — recruiters and ATS both look for this section first");
  if (!hasQuant)
    addW("Zero quantified achievements — add numbers/percentages to every impact statement");
  if (foundVerbs.length < 3)
    addW("Insufficient action verbs — begin each bullet with verbs like Built, Led, Reduced");
  if (wordCount < 250)
    addW(`Resume too short (${wordCount} words) — aim for 300–700 words with more detail`);
  if (wordCount > 1000)
    addW(`Resume too long (${wordCount} words) — trim to 1 page for freshers, 2 max`);
  if (!detected.projects && !detected.internship)
    addW("No projects or internship section — critical for entry-level profiles");
  if (!hasEmail)
    addW("No email address found — always include professional contact email");
  if (weaknesses.length === 0)
    addW("No major structural issues detected");

  // ATS Tips (role-aware, no duplication)
  const atsTips = [
    "Use exact section headers: 'Work Experience', 'Education', 'Skills' — avoid creative names",
    "Mirror the job description's exact phrases — ATS matches keywords verbatim",
    "Submit a text-based PDF — ATS cannot read scanned or image-based resumes",
    "Avoid tables, columns, text boxes, and headers/footers — they break ATS parsing",
    "List skills as plain text, never inside graphics, icons, or visual skill bars",
    "Write both acronym and full form: 'SQL (Structured Query Language)'",
    "Add the job title you're targeting inside your professional summary",
    "Quantify every achievement with numbers, percentages, or timeframes",
    "Use a professional filename: FirstName_LastName_Resume.pdf",
    "Ensure LinkedIn profile experience dates exactly match your resume",
  ];

  // LinkedIn Tips
  const roleLabel = getRoleLabel(role);
  const linkedInTips = [
    `Set your LinkedIn headline to '${roleLabel}' — recruiters filter by exact title`,
    "Write a 3–5 sentence LinkedIn summary as a narrative story, not a bullet list",
    "Request at least 3 recommendations from supervisors, professors, or peers",
    "Get endorsed for 10+ role-relevant skills to boost profile search ranking",
    "Enable 'Open to Work' with targeted role preferences for recruiter visibility",
    "Post or share industry content 2× per week — LinkedIn rewards active profiles",
    "Ensure all experience dates on LinkedIn match your resume exactly",
  ];

  const textPreview = text.replace(/\s{3,}/g, "\n\n").trim().substring(0, 900);

  return {
    atsScore: ats, jobMatchScore: jobMatch, keywordMatchPct: kwMatchPct,
    foundKeywords, missingKeywords: missingKeywords.slice(0,8),
    top5Missing: missingKeywords.slice(0,5),
    extractedSkills, detectedSections: foundSections, missingSections,
    wordCount, hasEmail, hasPhone, hasLinkedIn, hasGitHub,
    foundActionVerbs: foundVerbs, hasQuant, quantMatches: quantMatches.slice(0,5),
    readabilityScore: readability, formattingGood,
    strengths: strengths.slice(0,5), weaknesses: weaknesses.slice(0,5),
    atsTips, linkedInTips, textPreview,
    role: roleLabel,
  };
}

// ═══════════════════════════════════════════════════════
//  AI VIA GROQ
// ═══════════════════════════════════════════════════════

function callGroq(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1400,
      temperature: 0.35,
    });
    const opts = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return reject(new Error(p.error.message));
          resolve(p.choices?.[0]?.message?.content || "");
        } catch { reject(new Error("Parse error")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(28000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(body); req.end();
  });
}

function buildPrompt(text, analysis, role) {
  const roleLabel = getRoleLabel(role);
  return `You are an expert ATS resume coach for a ${roleLabel} role.
Analyze the following resume. Return ONLY a raw JSON object (no markdown, no code blocks).

RESUME (first 2000 chars):
${text.substring(0, 2000)}

EXISTING ANALYSIS:
Score: ${analysis.atsScore}/100 | Keywords found: ${analysis.foundKeywords.join(", ")||"none"} | Missing: ${analysis.missingKeywords.join(", ")||"none"} | Sections: ${analysis.detectedSections.join(", ")} | Words: ${analysis.wordCount}

Return this JSON exactly:
{
  "summary": "2-3 sentence professional assessment specific to ${roleLabel} role",
  "aiStrengths": ["unique strength 1", "unique strength 2", "unique strength 3"],
  "aiWeaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "aiSuggestions": ["actionable suggestion with example 1","actionable suggestion 2","actionable suggestion 3","actionable suggestion 4","actionable suggestion 5"],
  "rewriteSuggestion": "BEFORE: [quote a weak line from resume] → AFTER: [improved quantified version]",
  "recruiterView": "What a ${roleLabel} recruiter thinks in the first 10 seconds",
  "overallVerdict": "Excellent or Good or Average or Weak"
}`;
}

function parseAI(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1) { try { return JSON.parse(text.slice(s, e+1)); } catch {} }
  return null;
}

// ── Static fallbacks ─────────────────────────────────────────────

function staticSuggestions(a, role) {
  const sug = new Set();
  if (a.missingKeywords.length > 0)
    sug.add(`Add these role-critical keywords to your Skills section: ${a.missingKeywords.slice(0,4).join(", ")}`);
  if (!a.detectedSections.includes("summary"))
    sug.add("Add a 3-sentence Professional Summary: who you are → top skill → career goal");
  if (!a.hasQuant)
    sug.add(`Quantify your impact: "Built a feature" → "Built a feature used by 1,200+ daily users"`);
  if (a.foundActionVerbs.length < 4)
    sug.add("Start every bullet with an action verb: Built, Led, Reduced, Delivered, Optimized");
  if (a.missingSections.includes("projects"))
    sug.add("Add 2–3 relevant projects with tech stack, your role, and measurable outcome");
  if (a.wordCount < 300)
    sug.add("Expand resume to 300–600 words — add detail to projects and responsibilities");
  sug.add("Customize your resume keywords to match each specific job description before applying");
  return [...sug].slice(0,5);
}

function staticRewrite(a) {
  return a.hasQuant
    ? `BEFORE: "Worked on backend APIs" → AFTER: "Engineered 12 RESTful APIs handling 15K+ requests/day, reducing latency by 40% via Redis caching"`
    : `BEFORE: "Made a college project website" → AFTER: "Designed and deployed a full-stack event portal using React + Node.js, serving 600+ student registrations with 99.9% uptime"`;
}

function staticRecruiterView(a) {
  if (a.atsScore >= 75) return "Strong first impression — likely to pass ATS filters. Keyword alignment is solid and the structure is clear.";
  if (a.atsScore >= 50) return "Borderline — may pass lenient ATS but would be filtered by strict systems. Key sections or keywords are missing.";
  return "High rejection risk — a recruiter would immediately notice missing sections, weak keywords, and lack of quantified impact.";
}

function getVerdict(s) { return s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Average" : "Weak"; }

// ── Role label helpers ───────────────────────────────────────────
function getRoleLabel(role) {
  for (const cat of Object.values(CATEGORIES)) {
    if (cat.roles[role]) return cat.roles[role];
  }
  return role.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

// ═══════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", version: "5.0" }));

// Taxonomy (categories + roles for frontend selectors)
app.get("/api/taxonomy", (req, res) => {
  const out = {};
  for (const [catKey, cat] of Object.entries(CATEGORIES)) {
    out[catKey] = { label: cat.label, roles: cat.roles };
  }
  res.json(out);
});

// Analysis counter
app.get("/api/counter", (req, res) => res.json({ count: readCounter() }));

// Resume Builder data endpoint
app.get("/api/builder/templates", (req, res) => {
  res.json({
    templates: [
      { id: "minimal",    name: "Minimal",    desc: "Clean single-column, ATS-first design",     accent: "#1a1a2e" },
      { id: "modern",     name: "Modern",     desc: "Two-column with sidebar skills panel",       accent: "#0066cc" },
      { id: "corporate",  name: "Corporate",  desc: "Traditional format preferred by large firms",accent: "#2d4739" },
      { id: "creative",   name: "Creative",   desc: "Bold header with accent color strip",        accent: "#7c3aed" },
      { id: "student",    name: "Student",    desc: "Projects-forward layout for freshers",       accent: "#e85d04" },
    ],
  });
});

// Main analyze endpoint
app.post("/analyze", upload.single("resume"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded." });
  const filePath = req.file.path;
  const role = req.body.role || "software_dev";

  try {
    const buf  = fs.readFileSync(filePath);
    const pdf  = await pdfParse(buf);
    const text = pdf.text;

    if (!text || text.trim().length < 30)
      return res.status(422).json({ error: "Cannot extract text. Use a text-based PDF, not a scanned image." });

    const analysis = deepAnalyze(text, role);
    const count    = incrementCounter();

    let ai = null;
    if (GROQ_API_KEY) {
      try {
        ai = parseAI(await callGroq(buildPrompt(text, analysis, role)));
        if (ai) console.log("✅ AI OK");
      } catch (e) { console.warn("AI failed:", e.message); }
    }

    res.json({
      score:           analysis.atsScore,
      jobMatchScore:   analysis.jobMatchScore,
      keywordMatchPct: analysis.keywordMatchPct,
      keywordsMatched: analysis.foundKeywords,
      missingKeywords: analysis.missingKeywords,
      top5Missing:     analysis.top5Missing,
      extractedSkills: analysis.extractedSkills,
      detectedSections:analysis.detectedSections,
      missingSections: analysis.missingSections,
      wordCount:       analysis.wordCount,
      readabilityScore:analysis.readabilityScore,
      hasQuantified:   analysis.hasQuant,
      quantExamples:   analysis.quantMatches,
      foundActionVerbs:analysis.foundActionVerbs,
      formattingGood:  analysis.formattingGood,
      contact: { hasEmail:analysis.hasEmail, hasPhone:analysis.hasPhone, hasLinkedIn:analysis.hasLinkedIn, hasGitHub:analysis.hasGitHub },
      summary:          ai?.summary          || `Resume analyzed for ${analysis.role}. ATS score: ${analysis.atsScore}/100 with ${analysis.keywordMatchPct}% keyword match.`,
      strengths:        ai?.aiStrengths       || analysis.strengths,
      weaknesses:       ai?.aiWeaknesses      || analysis.weaknesses,
      suggestions:      ai?.aiSuggestions     || staticSuggestions(analysis, role),
      rewriteSuggestion:ai?.rewriteSuggestion || staticRewrite(analysis),
      recruiterView:    ai?.recruiterView     || staticRecruiterView(analysis),
      overallVerdict:   ai?.overallVerdict    || getVerdict(analysis.atsScore),
      atsTips:      analysis.atsTips,
      linkedInTips: analysis.linkedInTips,
      textPreview:  analysis.textPreview,
      role:         analysis.role,
      aiPowered:    !!ai,
      totalAnalyses:count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed. Please try a different PDF." });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// Error handler
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || "Request error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 ResumeRank v5 → http://localhost:${PORT}`);
  console.log(GROQ_API_KEY ? `✅ AI enabled (${GROQ_MODEL})` : `⚠️  No GROQ_API_KEY — smart static mode`);
});
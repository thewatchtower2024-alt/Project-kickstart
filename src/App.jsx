import { useState, useCallback, useRef } from "react";

// ── AI Pipeline ───────────────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const callClaude = async (system, userContent, apiKey, maxTokens = 3000, useSearch = false) => {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
};

const parseJSON = (text) => {
  try {
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return null;
  }
};

// ── Work type config ──────────────────────────────────────────────────────────
const WORK_TYPES = [
  { id: "new_app",     label: "New Application",   color: "#3b82f6", icon: "⬡" },
  { id: "new_feature", label: "New Feature",        color: "#10b981", icon: "◈" },
  { id: "enhancement", label: "Enhancement",        color: "#8b5cf6", icon: "◉" },
  { id: "integration", label: "Integration",        color: "#f59e0b", icon: "⬡" },
  { id: "migration",   label: "Migration",          color: "#ef4444", icon: "▶" },
  { id: "bug_fix",     label: "Bug Fix / Hotfix",   color: "#64748b", icon: "✕" },
  { id: "research",    label: "Research Spike",     color: "#ec4899", icon: "◎" },
  { id: "platform",    label: "Platform / Infra",   color: "#06b6d4", icon: "⬡" },
];

const COMPLEXITY = {
  low:    { label: "Low",    color: "#10b981", weeks: "1–2 weeks",  sprints: "1",     pts: "13–20"  },
  medium: { label: "Medium", color: "#f59e0b", weeks: "3–6 weeks",  sprints: "2–3",   pts: "34–55"  },
  high:   { label: "High",   color: "#ef4444", weeks: "6–12 weeks", sprints: "3–6",   pts: "55–100" },
  xl:     { label: "XL",     color: "#8b5cf6", weeks: "12+ weeks",  sprints: "6–12+", pts: "100+"   },
};

// ── Pipeline steps ────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: "classify",     label: "Analyzing & classifying idea",         icon: "◎" },
  { id: "research",     label: "Researching domain & tech landscape",  icon: "⬡" },
  { id: "brd",          label: "Generating Business Requirements",     icon: "▣" },
  { id: "storymap",     label: "Building story map",                   icon: "◈" },
  { id: "techdoc",      label: "Drafting technical architecture",      icon: "⬡" },
  { id: "risks",        label: "Identifying risks & dependencies",     icon: "⚠" },
  { id: "stakeholder",  label: "Creating stakeholder artifacts",       icon: "◉" },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }

  body {
    font-family: 'Outfit', sans-serif;
    background: #070b12;
    color: #cbd5e1;
    min-height: 100vh;
    background-image:
      linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .app { display: flex; flex-direction: column; min-height: 100vh; }

  /* ── Header ── */
  .hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(7,11,18,0.9); backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
  }
  .hdr-logo { display: flex; align-items: center; gap: 12px; }
  .hdr-mark {
    font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
    color: #fff; line-height: 1;
  }
  .hdr-mark span { color: #f59e0b; }
  .hdr-sub { font-size: 10px; color: #334155; font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase; letter-spacing: .15em; margin-top: 2px; }
  .hdr-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .key-field {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px; padding: 5px 10px;
  }
  .key-label { font-size: 10px; font-family: 'JetBrains Mono',monospace;
    color: #475569; text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
  .key-field input {
    background: transparent; border: none; outline: none;
    font-family: 'JetBrains Mono',monospace; font-size: 11px; color: #94a3b8;
    width: 180px;
  }
  .key-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Main layout ── */
  .main { flex: 1; display: flex; flex-direction: column; padding: 32px; max-width: 1400px;
    width: 100%; margin: 0 auto; gap: 24px; }

  /* ── Input phase ── */
  .input-phase { max-width: 820px; margin: 0 auto; width: 100%; padding-top: 40px; }
  .big-label {
    font-family: 'Bebas Neue', sans-serif; font-size: 52px; letter-spacing: 4px;
    color: #fff; line-height: 1; margin-bottom: 8px;
  }
  .big-label span { color: #f59e0b; }
  .big-sub { font-size: 15px; color: #475569; margin-bottom: 32px; line-height: 1.6; }
  .idea-box {
    background: rgba(14,20,32,0.8); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 20px; position: relative;
    transition: border-color .2s;
  }
  .idea-box:focus-within { border-color: rgba(245,158,11,0.4); }
  .idea-box textarea {
    width: 100%; background: transparent; border: none; outline: none;
    font-family: 'Outfit',sans-serif; font-size: 16px; color: #e2e8f0;
    resize: none; min-height: 140px; line-height: 1.7;
  }
  .idea-box textarea::placeholder { color: #334155; }
  .idea-footer { display: flex; justify-content: space-between; align-items: center;
    margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.05); }
  .char-count { font-size: 11px; color: #334155; font-family: 'JetBrains Mono', monospace; }
  .btn-launch {
    display: flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border: none; border-radius: 8px; padding: 10px 24px;
    font-family: 'Outfit',sans-serif; font-size: 14px; font-weight: 700;
    color: #000; cursor: pointer; transition: opacity .15s, transform .1s;
    letter-spacing: .02em;
  }
  .btn-launch:disabled { opacity: .4; cursor: not-allowed; transform: none; }
  .btn-launch:not(:disabled):hover { opacity: .9; transform: translateY(-1px); }
  .recent-label { font-size: 11px; color: #334155; font-family: 'JetBrains Mono',monospace;
    text-transform: uppercase; letter-spacing: .1em; margin: 32px 0 14px; }
  .recent-grid { display: flex; flex-direction: column; gap: 8px; }
  .recent-card {
    display: flex; align-items: center; gap: 14px;
    background: rgba(14,20,32,0.6); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 10px; padding: 12px 16px; cursor: pointer; transition: border-color .15s;
  }
  .recent-card:hover { border-color: rgba(245,158,11,0.25); }
  .recent-type { width: 28px; height: 28px; border-radius: 6px; display: flex;
    align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
  .recent-info { flex: 1; min-width: 0; }
  .recent-title { font-size: 13px; font-weight: 600; color: #e2e8f0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .recent-meta { font-size: 11px; color: #475569; font-family: 'JetBrains Mono',monospace;
    margin-top: 2px; }
  .recent-badge { font-size: 10px; padding: 2px 7px; border-radius: 4px;
    font-family: 'JetBrains Mono',monospace; font-weight: 700; flex-shrink: 0; }

  /* ── Pipeline progress ── */
  .pipeline-phase { max-width: 580px; margin: 0 auto; width: 100%; padding-top: 60px; text-align: center; }
  .pipe-title { font-family: 'Bebas Neue',sans-serif; font-size: 36px; letter-spacing: 3px;
    color: #fff; margin-bottom: 8px; }
  .pipe-sub { font-size: 13px; color: #475569; margin-bottom: 48px; }
  .pipe-steps { display: flex; flex-direction: column; gap: 0; text-align: left; }
  .pipe-step {
    display: flex; align-items: center; gap: 16px;
    padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: opacity .3s;
  }
  .pipe-icon {
    width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center;
    justify-content: center; font-size: 14px; flex-shrink: 0; transition: all .3s;
  }
  .pipe-icon.done { background: rgba(16,185,129,0.15); color: #10b981; }
  .pipe-icon.active { background: rgba(245,158,11,0.15); color: #f59e0b;
    animation: pulse 1.4s ease-in-out infinite; }
  .pipe-icon.idle { background: rgba(255,255,255,0.03); color: #334155; }
  .pipe-step-label { font-size: 14px; font-weight: 500; }
  .pipe-step-label.done { color: #64748b; }
  .pipe-step-label.active { color: #f59e0b; }
  .pipe-step-label.idle { color: #334155; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  .pipe-step-check { margin-left: auto; font-size: 14px; color: #10b981; }

  /* ── Results phase ── */
  .results-layout { display: flex; gap: 24px; align-items: flex-start; }
  .sidebar { width: 260px; flex-shrink: 0; position: sticky; top: 80px; }
  .sidebar-section { margin-bottom: 24px; }
  .sidebar-label { font-size: 10px; color: #334155; font-family: 'JetBrains Mono',monospace;
    text-transform: uppercase; letter-spacing: .12em; margin-bottom: 10px; padding-left: 4px; }
  .side-btn {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 9px 12px; border-radius: 8px; border: none; background: transparent;
    cursor: pointer; font-family: 'Outfit',sans-serif; font-size: 13px; font-weight: 500;
    color: #475569; transition: all .15s; margin-bottom: 2px; text-align: left;
  }
  .side-btn:hover { background: rgba(255,255,255,0.04); color: #94a3b8; }
  .side-btn.active { background: rgba(245,158,11,0.1); color: #f59e0b;
    border-left: 2px solid #f59e0b; padding-left: 10px; }
  .side-btn .s-icon { width: 22px; height: 22px; border-radius: 5px; display: flex;
    align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  .content-area { flex: 1; min-width: 0; }

  /* ── Cards ── */
  .card {
    background: rgba(14,20,32,0.8); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 24px; margin-bottom: 20px;
  }
  .card-title {
    font-family: 'Bebas Neue',sans-serif; font-size: 18px; letter-spacing: 2px;
    color: #fff; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
  }
  .card-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }

  /* ── Classification card ── */
  .class-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 14px; }
  .class-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 14px 16px; }
  .class-item-label { font-size: 10px; color: #334155; font-family: 'JetBrains Mono',monospace;
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px; }
  .class-item-val { font-size: 15px; font-weight: 700; }
  .class-item-sub { font-size: 11px; color: #475569; margin-top: 3px; }

  /* ── BRD / markdown doc ── */
  .doc-body { font-size: 14px; line-height: 1.8; color: #94a3b8; }
  .doc-body h1 { font-family: 'Bebas Neue',sans-serif; font-size: 28px; letter-spacing: 2px;
    color: #fff; margin: 24px 0 12px; }
  .doc-body h2 { font-size: 16px; font-weight: 700; color: #e2e8f0; margin: 20px 0 10px;
    padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .doc-body h3 { font-size: 14px; font-weight: 700; color: #cbd5e1; margin: 14px 0 8px; }
  .doc-body p { margin-bottom: 10px; }
  .doc-body ul, .doc-body ol { padding-left: 20px; margin-bottom: 10px; }
  .doc-body li { margin-bottom: 4px; }
  .doc-body code { font-family: 'JetBrains Mono',monospace; font-size: 12px;
    background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 3px; color: #f59e0b; }
  .doc-body pre { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 14px; margin: 12px 0; overflow-x: auto; }
  .doc-body pre code { background: none; padding: 0; color: #10b981; }
  .doc-body table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .doc-body th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700;
    color: #475569; text-transform: uppercase; letter-spacing: .08em;
    border-bottom: 1px solid rgba(255,255,255,0.08); }
  .doc-body td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #94a3b8; }
  .doc-body blockquote { border-left: 3px solid #f59e0b; padding-left: 14px; color: #64748b;
    font-style: italic; margin: 12px 0; }
  .doc-body strong { color: #e2e8f0; font-weight: 700; }

  /* ── Story map ── */
  .story-scroll { overflow-x: auto; padding-bottom: 16px; }
  .story-map { display: flex; gap: 16px; min-width: max-content; }
  .story-group { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 16px; width: 280px; }
  .story-group-title { font-family: 'Bebas Neue',sans-serif; font-size: 14px; letter-spacing: 1.5px;
    color: #f59e0b; margin-bottom: 12px; }
  .story-journey { margin-bottom: 14px; }
  .story-journey-name { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: .08em; }
  .story-epic {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;
  }
  .story-epic.mvp { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.04); }
  .story-epic-name { font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;
    display: flex; align-items: center; gap: 6px; }
  .mvp-badge { font-size: 9px; padding: 1px 5px; background: rgba(245,158,11,0.2);
    color: #f59e0b; border-radius: 3px; font-family: 'JetBrains Mono',monospace;
    font-weight: 700; letter-spacing: .06em; }
  .story-item { font-size: 11px; color: #64748b; padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03); line-height: 1.5; }
  .story-item:last-child { border-bottom: none; }

  /* ── Risk register ── */
  .risk-grid { display: flex; flex-direction: column; gap: 10px; }
  .risk-card {
    display: flex; gap: 14px; align-items: flex-start;
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 14px 16px; border-left: 3px solid;
  }
  .risk-id { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: #475569;
    flex-shrink: 0; padding-top: 2px; }
  .risk-body { flex: 1; }
  .risk-title { font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }
  .risk-desc { font-size: 12px; color: #64748b; line-height: 1.6; margin-bottom: 8px; }
  .risk-mitigation { font-size: 12px; color: #94a3b8; line-height: 1.5;
    background: rgba(255,255,255,0.02); border-radius: 6px; padding: 8px 10px; }
  .risk-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .risk-badge { font-size: 10px; padding: 2px 7px; border-radius: 4px;
    font-family: 'JetBrains Mono',monospace; font-weight: 700; }

  /* ── Roadmap ── */
  .roadmap { display: flex; flex-direction: column; gap: 0; position: relative; padding-left: 32px; }
  .roadmap::before { content: ""; position: absolute; left: 10px; top: 8px; bottom: 8px;
    width: 2px; background: rgba(255,255,255,0.06); }
  .roadmap-phase { position: relative; padding-bottom: 28px; }
  .roadmap-phase::before { content: ""; position: absolute; left: -26px; top: 6px;
    width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
  .roadmap-phase-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .roadmap-phase-name { font-family: 'Bebas Neue',sans-serif; font-size: 16px; letter-spacing: 1.5px;
    color: #fff; }
  .roadmap-phase-dur { font-size: 11px; font-family: 'JetBrains Mono',monospace;
    color: #475569; }
  .roadmap-phase-items { display: flex; flex-direction: column; gap: 4px; }
  .roadmap-item { font-size: 13px; color: #64748b; display: flex; gap: 8px; align-items: flex-start; }
  .roadmap-item::before { content: "→"; color: #334155; flex-shrink: 0; }

  /* ── MVP callout ── */
  .mvp-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mvp-col { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 16px; }
  .mvp-col-label { font-size: 10px; font-family: 'JetBrains Mono',monospace; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px; }
  .mvp-col.in .mvp-col-label { color: #10b981; }
  .mvp-col.out .mvp-col-label { color: #ef4444; }
  .mvp-item { font-size: 13px; color: #64748b; padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; gap: 8px; align-items: flex-start; }
  .mvp-item:last-child { border-bottom: none; }
  .mvp-item.in::before { content: "✓"; color: #10b981; flex-shrink: 0; font-weight: 700; }
  .mvp-item.out::before { content: "✕"; color: #475569; flex-shrink: 0; font-weight: 700; }

  /* ── Sprint plan ── */
  .sprint-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .sprint-table th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700;
    color: #334155; text-transform: uppercase; letter-spacing: .1em;
    border-bottom: 1px solid rgba(255,255,255,0.06); }
  .sprint-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #64748b; }
  .sprint-table td:first-child { font-family: 'JetBrains Mono',monospace; color: #f59e0b; }

  /* ── Export bar ── */
  .export-bar { display: flex; gap: 8px; margin-bottom: 16px; }
  .btn-export {
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 7px; padding: 7px 14px; font-family: 'Outfit',sans-serif;
    font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; transition: all .15s;
  }
  .btn-export:hover { background: rgba(255,255,255,0.07); color: #94a3b8; }
  .btn-new {
    display: flex; align-items: center; gap: 6px;
    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2);
    border-radius: 7px; padding: 7px 14px; font-family: 'Outfit',sans-serif;
    font-size: 12px; font-weight: 700; color: #f59e0b; cursor: pointer; transition: all .15s;
  }
  .btn-new:hover { background: rgba(245,158,11,0.15); }

  /* ── Misc ── */
  .badge { display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; padding: 2px 8px; border-radius: 4px;
    font-family: 'JetBrains Mono',monospace; font-weight: 700; letter-spacing: .06em; }
  .b-green { background: rgba(16,185,129,0.15); color: #10b981; }
  .b-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .b-blue  { background: rgba(59,130,246,0.15);  color: #60a5fa; }
  .b-red   { background: rgba(239,68,68,0.15);   color: #ef4444; }
  .b-purple{ background: rgba(139,92,246,0.15);  color: #a78bfa; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 24px; color: #334155; font-size: 14px; text-align: center; line-height: 1.8; }

  @media(max-width:900px) {
    .results-layout { flex-direction: column; }
    .sidebar { width: 100%; position: static; }
    .side-btn { display: inline-flex; }
    .mvp-split { grid-template-columns: 1fr; }
    .big-label { font-size: 38px; }
    .main { padding: 16px; }
  }
`;

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>")
    .replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{3}\s+(.+)$/gm, "<h3>$3</h3>".replace("$3","$1"))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\|\s*(.+)\s*\|$/gm, (m, row) => {
      const cells = row.split("|").map(c => c.trim());
      return `<tr>${cells.map(c => c.match(/^[-:]+$/) ? "" : `<td>${c}</td>`).join("")}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n)+/gs, m => `<table>${m}</table>`)
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n)+/gs, m => `<ul>${m}</ul>`)
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupbtl])/gm, "")
    .replace(/^(.+)$/gm, m => m.match(/^</) ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, "");
}

// ── AI prompts ────────────────────────────────────────────────────────────────
const SYS_CLASSIFY = `You are a senior technical PM and solutions architect with 15+ years experience.
Your job is to analyze a project idea and classify it precisely, researching the technology landscape as needed.
Return ONLY valid JSON — no markdown, no preamble, no explanation.`;

const SYS_DOCS = `You are a senior business analyst and technical architect.
Generate professional, detailed project documentation. Be specific and actionable.
Use the provided classification context to tailor all output to the actual project.`;

const buildClassifyPrompt = (idea) => `Analyze this project idea and return a JSON object with exactly this shape:
{
  "projectTitle": "concise professional project name",
  "workType": "new_app|new_feature|enhancement|integration|migration|bug_fix|research|platform",
  "complexity": "low|medium|high|xl",
  "domain": "e.g. FinTech, HealthTech, E-Commerce, Internal Tooling, etc.",
  "summary": "2-3 sentence executive summary of what this project is",
  "suggestedStack": ["technology1", "technology2"],
  "keyStakeholders": ["role1", "role2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "openQuestions": ["question 1", "question 2", "question 3"],
  "researchNotes": "2-3 sentences on relevant industry patterns, comparable solutions, or tech considerations found through research"
}

PROJECT IDEA:
${idea}`;

const buildBRDPrompt = (idea, classification) => `Generate a comprehensive Business Requirements Document (BRD) in markdown format.

PROJECT CONTEXT:
${JSON.stringify(classification, null, 2)}

ORIGINAL IDEA:
${idea}

Write the BRD with these sections:
# [Project Title]
## Executive Summary
## Business Objectives
## Scope
### In Scope
### Out of Scope
## Stakeholders
## Functional Requirements
## Non-Functional Requirements
## Assumptions & Constraints
## Success Metrics
## Timeline Estimate
## Approval`;

const buildStoryMapPrompt = (idea, classification) => `Generate a story map as JSON. Be thorough — 3-5 user groups, 2-4 journeys per group, 2-4 epics per journey, 3-6 stories per epic.

PROJECT: ${classification.projectTitle}
WORK TYPE: ${classification.workType}
COMPLEXITY: ${classification.complexity}
CONTEXT: ${classification.summary}

Return ONLY this JSON shape:
{
  "userGroups": [
    {
      "name": "User Group Name",
      "description": "brief role description",
      "journeys": [
        {
          "name": "Journey Name",
          "epics": [
            {
              "id": "E-001",
              "name": "Epic Name",
              "mvp": true,
              "stories": [
                "As a [user], I want to [action] so that [benefit]"
              ]
            }
          ]
        }
      ]
    }
  ]
}`;

const buildTechDocPrompt = (idea, classification) => `Generate a technical architecture document in markdown.

PROJECT: ${classification.projectTitle}
STACK: ${classification.suggestedStack?.join(", ")}
COMPLEXITY: ${classification.complexity}
CONTEXT: ${classification.summary}
ORIGINAL IDEA: ${idea}

Sections to include:
# Technical Architecture: [Project Title]
## Architecture Overview
## Recommended Tech Stack (with rationale per choice)
## System Components
## Data Model (key entities and relationships)
## API Design (key endpoints or event flows)
## Security Considerations
## Deployment & Infrastructure
## Development Phases
## Technical Risks & Mitigations`;

const buildRiskPrompt = (idea, classification) => `Generate a risk register as JSON. Include 6-10 risks across categories.

PROJECT: ${classification.projectTitle}
CONTEXT: ${classification.summary}
COMPLEXITY: ${classification.complexity}
DOMAIN: ${classification.domain}

Return ONLY this JSON:
{
  "risks": [
    {
      "id": "R-001",
      "category": "Technical|Business|Resource|Schedule|Compliance|Security",
      "title": "concise risk title",
      "description": "what could go wrong and why",
      "probability": "High|Medium|Low",
      "impact": "High|Medium|Low",
      "mitigation": "specific action to reduce or manage this risk",
      "owner": "role responsible (e.g. Tech Lead, PM, Product Owner)"
    }
  ]
}`;

const buildStakeholderPrompt = (idea, classification) => `Generate stakeholder artifacts as JSON.

PROJECT: ${classification.projectTitle}
CONTEXT: ${classification.summary}
COMPLEXITY: ${classification.complexity}
DOMAIN: ${classification.domain}
OPEN QUESTIONS: ${classification.openQuestions?.join("; ")}

Return ONLY this JSON:
{
  "roadmap": {
    "phases": [
      {
        "name": "Phase 1: Discovery & Setup",
        "duration": "2 weeks",
        "milestones": ["milestone 1"],
        "deliverables": ["deliverable 1"],
        "features": ["feature 1"]
      }
    ]
  },
  "mvpCallout": {
    "objective": "one sentence — the core value the MVP must deliver",
    "estimatedEffort": "X sprints / Y weeks",
    "inScope": ["feature or capability included in MVP"],
    "outOfScope": ["deferred to later phase"],
    "successCriteria": ["measurable outcome that defines MVP success"]
  },
  "burndownEstimate": {
    "totalPoints": 80,
    "velocityAssumption": 30,
    "sprints": [
      {
        "number": 1,
        "focus": "sprint theme",
        "keyStories": ["story 1", "story 2"],
        "points": 30
      }
    ]
  }
}`;

// ── Main App component ────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,   setApiKey]   = useState(import.meta.env.VITE_ANTHROPIC_API_KEY || "");
  const [idea,     setIdea]     = useState("");
  const [phase,    setPhase]    = useState("idle"); // idle|running|complete|error
  const [pipeStep, setPipeStep] = useState(-1);     // current pipeline step index
  const [error,    setError]    = useState("");

  const [classification, setClassification] = useState(null);
  const [documents,      setDocuments]      = useState(null);
  const [docTab,         setDocTab]         = useState("overview");

  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kickstart-projects") || "[]"); }
    catch { return []; }
  });

  const saveProject = (proj) => {
    const entry = { id: Date.now().toString(), savedAt: new Date().toISOString(), ...proj };
    const updated = [entry, ...projects].slice(0, 20);
    setProjects(updated);
    try { localStorage.setItem("kickstart-projects", JSON.stringify(updated)); } catch {}
    return entry;
  };

  const loadProject = (entry) => {
    setIdea(entry.idea);
    setClassification(entry.classification);
    setDocuments(entry.documents);
    setPhase("complete");
    setDocTab("overview");
  };

  // ── Run pipeline ─────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (!idea.trim()) return;
    if (!apiKey) { alert("Please enter your Anthropic API key in the header."); return; }

    setPhase("running");
    setError("");
    setClassification(null);
    setDocuments(null);
    setPipeStep(0);

    try {
      // Step 0-1: Classify + Research (with web search)
      const classifyRaw = await callClaude(SYS_CLASSIFY, buildClassifyPrompt(idea), apiKey, 1500, true);
      const cls = parseJSON(classifyRaw);
      if (!cls) throw new Error("Classification failed — could not parse AI response.");
      setClassification(cls);
      setPipeStep(2);

      // Step 2: BRD
      const brdText = await callClaude(SYS_DOCS, buildBRDPrompt(idea, cls), apiKey, 3000);
      setPipeStep(3);

      // Step 3: Story Map
      const storyRaw = await callClaude(SYS_DOCS, buildStoryMapPrompt(idea, cls), apiKey, 3000);
      const storyMap = parseJSON(storyRaw);
      setPipeStep(4);

      // Step 4: Technical doc
      const techText = await callClaude(SYS_DOCS, buildTechDocPrompt(idea, cls), apiKey, 3000);
      setPipeStep(5);

      // Step 5: Risks
      const riskRaw = await callClaude(SYS_DOCS, buildRiskPrompt(idea, cls), apiKey, 2000);
      const risks = parseJSON(riskRaw);
      setPipeStep(6);

      // Step 6: Stakeholder artifacts
      const stakeRaw = await callClaude(SYS_DOCS, buildStakeholderPrompt(idea, cls), apiKey, 2500);
      const stakeholder = parseJSON(stakeRaw);
      setPipeStep(7);

      const docs = { brd: brdText, storyMap, techDoc: techText, risks, stakeholder };
      setDocuments(docs);
      setPhase("complete");
      setDocTab("overview");
      saveProject({ idea, classification: cls, documents: docs, title: cls.projectTitle });

    } catch(e) {
      console.error(e);
      setError(e.message);
      setPhase("error");
    }
  }, [idea, apiKey]);

  // ── Export helpers ────────────────────────────────────────────────────────
  const exportAll = () => {
    if (!documents || !classification) return;
    const out = [
      `# ${classification.projectTitle}\n`,
      `**Type:** ${classification.workType} | **Complexity:** ${classification.complexity} | **Domain:** ${classification.domain}`,
      `\n---\n`,
      documents.brd || "",
      `\n---\n# Technical Architecture\n`,
      documents.techDoc || "",
      `\n---\n# Risk Register\n`,
      ...(documents.risks?.risks || []).map(r =>
        `## ${r.id}: ${r.title}\n**Category:** ${r.category} | **P:** ${r.probability} | **I:** ${r.impact}\n${r.description}\n**Mitigation:** ${r.mitigation}\n`),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "text/markdown" }));
    a.download = `${(classification.projectTitle||"project").replace(/\s+/g,"-").toLowerCase()}-kickstart.md`;
    a.click();
  };

  const exportJSON = () => {
    if (!documents || !classification) return;
    const out = JSON.stringify({ classification, documents }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "application/json" }));
    a.download = `${(classification.projectTitle||"project").replace(/\s+/g,"-").toLowerCase()}-kickstart.json`;
    a.click();
  };

  // ── Work type lookup ──────────────────────────────────────────────────────
  const wtInfo = (id) => WORK_TYPES.find(w => w.id === id) || WORK_TYPES[0];
  const cxInfo = (id) => COMPLEXITY[id] || COMPLEXITY.medium;

  // ── Risk color ────────────────────────────────────────────────────────────
  const riskColor = (p, i) => {
    const score = (p==="High"?3:p==="Medium"?2:1) * (i==="High"?3:i==="Medium"?2:1);
    if (score >= 6) return "#ef4444";
    if (score >= 3) return "#f59e0b";
    return "#10b981";
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Header ── */}
        <header className="hdr">
          <div className="hdr-logo">
            <div>
              <div className="hdr-mark">PROJECT<span>KICKSTART</span></div>
              <div className="hdr-sub">AI Operations · PM Intelligence Layer</div>
            </div>
          </div>
          <div className="hdr-right">
            <div className="key-field">
              <span className="key-label">API Key</span>
              <div className="key-dot" style={{ background: apiKey ? "#10b981" : "#f59e0b" }}/>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..." />
            </div>
            {phase === "complete" && (
              <button className="btn-new" onClick={() => { setPhase("idle"); setIdea(""); }}>
                + New Project
              </button>
            )}
          </div>
        </header>

        <main className="main">

          {/* ════════ IDLE — input phase ════════ */}
          {phase === "idle" && (
            <div className="input-phase">
              <div className="big-label">KICK OFF<br/><span>YOUR PROJECT</span></div>
              <div className="big-sub">
                Describe your idea in plain language. AI will classify the work, research the domain,
                and generate your full project documentation package in seconds.
              </div>

              {!apiKey && (
                <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",
                  borderRadius:10,padding:"14px 18px",marginBottom:24,fontSize:13,color:"#94a3b8",lineHeight:1.7}}>
                  🔑 Enter your Anthropic API key in the header to get started.&nbsp;
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                    style={{color:"#f59e0b"}}>Get a key →</a>
                </div>
              )}

              <div className="idea-box">
                <textarea
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  placeholder={`Describe your project idea here...\n\nExamples:\n• "Build a customer portal for our SaaS platform so users can manage their subscriptions, view invoices, and submit support tickets"\n• "We need to integrate our CRM with the new payment processor API and sync customer data both ways"\n• "The login page throws a 500 error when users have special characters in their password"`}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runPipeline(); }}
                />
                <div className="idea-footer">
                  <span className="char-count">{idea.length} chars · Ctrl+Enter to analyze</span>
                  <button className="btn-launch" onClick={runPipeline} disabled={!idea.trim() || !apiKey}>
                    ◎ Analyze &amp; Generate Docs
                  </button>
                </div>
              </div>

              {projects.length > 0 && (
                <>
                  <div className="recent-label">Recent Projects</div>
                  <div className="recent-grid">
                    {projects.slice(0, 5).map(p => {
                      const wt = wtInfo(p.classification?.workType);
                      const cx = cxInfo(p.classification?.complexity);
                      return (
                        <div key={p.id} className="recent-card" onClick={() => loadProject(p)}>
                          <div className="recent-type" style={{background:`${wt.color}18`,color:wt.color}}>
                            {wt.icon}
                          </div>
                          <div className="recent-info">
                            <div className="recent-title">{p.title || p.classification?.projectTitle || "Untitled Project"}</div>
                            <div className="recent-meta">
                              {new Date(p.savedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                              &nbsp;·&nbsp;{p.classification?.domain}
                            </div>
                          </div>
                          <span className="recent-badge" style={{background:`${cx.color}18`,color:cx.color}}>
                            {cx.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════ RUNNING — pipeline progress ════════ */}
          {phase === "running" && (
            <div className="pipeline-phase">
              <div className="pipe-title">ANALYZING PROJECT</div>
              <div className="pipe-sub">AI is researching your idea and generating documentation</div>
              <div className="pipe-steps">
                {PIPELINE_STEPS.map((step, i) => {
                  const status = i < pipeStep ? "done" : i === pipeStep ? "active" : "idle";
                  return (
                    <div key={step.id} className={`pipe-step`} style={{opacity: status==="idle"?.4:1}}>
                      <div className={`pipe-icon ${status}`}>{step.icon}</div>
                      <span className={`pipe-step-label ${status}`}>{step.label}</span>
                      {status === "done" && <span className="pipe-step-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════ ERROR ════════ */}
          {phase === "error" && (
            <div style={{maxWidth:580,margin:"60px auto",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>⚠</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"#ef4444",marginBottom:12}}>
                PIPELINE FAILED
              </div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:24,background:"rgba(239,68,68,0.05)",
                border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"12px 16px",fontFamily:"'JetBrains Mono',monospace"}}>
                {error}
              </div>
              <button className="btn-launch" onClick={() => setPhase("idle")}>← Try Again</button>
            </div>
          )}

          {/* ════════ COMPLETE — results ════════ */}
          {phase === "complete" && classification && documents && (
            <div className="results-layout">

              {/* ── Sidebar nav ── */}
              <aside className="sidebar">
                <div className="sidebar-section">
                  <div className="sidebar-label">Project</div>
                  {[
                    { id:"overview",    label:"Overview",            icon:"◎", bg:wtInfo(classification.workType).color },
                    { id:"brd",         label:"Business Requirements", icon:"▣", bg:"#3b82f6" },
                    { id:"storymap",    label:"Story Map",            icon:"◈", bg:"#10b981" },
                    { id:"techdoc",     label:"Technical Docs",       icon:"⬡", bg:"#06b6d4" },
                    { id:"risks",       label:"Risk Register",        icon:"⚠", bg:"#ef4444" },
                    { id:"stakeholder", label:"Stakeholder Artifacts", icon:"◉", bg:"#8b5cf6" },
                  ].map(t => (
                    <button key={t.id} className={`side-btn ${docTab===t.id?"active":""}`}
                      onClick={() => setDocTab(t.id)}>
                      <span className="s-icon" style={{background:`${t.bg}18`,color:t.bg}}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="sidebar-section">
                  <div className="sidebar-label">Export</div>
                  <button className="side-btn" onClick={exportAll}>
                    <span className="s-icon" style={{background:"rgba(16,185,129,0.12)",color:"#10b981"}}>↓</span>
                    Export Markdown
                  </button>
                  <button className="side-btn" onClick={exportJSON}>
                    <span className="s-icon" style={{background:"rgba(59,130,246,0.12)",color:"#60a5fa"}}>{ }</span>
                    Export JSON
                  </button>
                </div>
              </aside>

              {/* ── Content area ── */}
              <div className="content-area">

                {/* ── OVERVIEW ── */}
                {docTab === "overview" && (
                  <>
                    <div className="card">
                      <div className="card-title">
                        <span style={{color:wtInfo(classification.workType).color}}>
                          {wtInfo(classification.workType).icon}
                        </span>
                        {classification.projectTitle}
                      </div>
                      <div className="class-grid">
                        {[
                          { label:"Work Type",  val: wtInfo(classification.workType).label,
                            color: wtInfo(classification.workType).color },
                          { label:"Complexity", val: cxInfo(classification.complexity).label,
                            sub: cxInfo(classification.complexity).weeks,
                            color: cxInfo(classification.complexity).color },
                          { label:"Est. Sprints", val: cxInfo(classification.complexity).sprints,
                            sub: cxInfo(classification.complexity).pts + " pts", color:"#f59e0b" },
                          { label:"Domain",     val: classification.domain, color:"#94a3b8" },
                        ].map(item => (
                          <div key={item.label} className="class-item">
                            <div className="class-item-label">{item.label}</div>
                            <div className="class-item-val" style={{color:item.color}}>{item.val}</div>
                            {item.sub && <div className="class-item-sub">{item.sub}</div>}
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:14,color:"#64748b",lineHeight:1.8}}>{classification.summary}</div>
                    </div>

                    {classification.suggestedStack?.length > 0 && (
                      <div className="card">
                        <div className="card-title">⬡ Suggested Stack</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {classification.suggestedStack.map(s => (
                            <span key={s} className="badge b-blue" style={{fontSize:12,padding:"4px 10px"}}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                      {classification.keyStakeholders?.length > 0 && (
                        <div className="card">
                          <div className="card-title" style={{fontSize:14}}>◉ Key Stakeholders</div>
                          {classification.keyStakeholders.map(s => (
                            <div key={s} style={{fontSize:13,color:"#64748b",padding:"5px 0",
                              borderBottom:"1px solid rgba(255,255,255,0.04)"}}>→ {s}</div>
                          ))}
                        </div>
                      )}
                      {classification.openQuestions?.length > 0 && (
                        <div className="card">
                          <div className="card-title" style={{fontSize:14}}>? Open Questions</div>
                          {classification.openQuestions.map((q,i) => (
                            <div key={i} style={{fontSize:13,color:"#64748b",padding:"5px 0",
                              borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              <span style={{color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace",
                                fontSize:11,marginRight:8}}>Q{i+1}</span>{q}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {classification.researchNotes && (
                      <div className="card" style={{borderColor:"rgba(59,130,246,0.15)",
                        background:"rgba(59,130,246,0.03)"}}>
                        <div className="card-title" style={{color:"#60a5fa",fontSize:14}}>⬡ Research Notes</div>
                        <div style={{fontSize:14,color:"#64748b",lineHeight:1.8}}>
                          {classification.researchNotes}
                        </div>
                      </div>
                    )}

                    {classification.assumptions?.length > 0 && (
                      <div className="card">
                        <div className="card-title" style={{fontSize:14}}>◎ Assumptions</div>
                        {classification.assumptions.map((a,i) => (
                          <div key={i} style={{fontSize:13,color:"#64748b",padding:"5px 0",
                            borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                            <span style={{color:"#8b5cf6",fontFamily:"'JetBrains Mono',monospace",
                              fontSize:11,marginRight:8}}>A{i+1}</span>{a}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── BRD ── */}
                {docTab === "brd" && (
                  <div className="card">
                    <div className="card-title">▣ Business Requirements Document</div>
                    <div className="doc-body" dangerouslySetInnerHTML={{
                      __html: renderMarkdown(documents.brd || "")
                    }}/>
                  </div>
                )}

                {/* ── STORY MAP ── */}
                {docTab === "storymap" && (
                  <div className="card">
                    <div className="card-title">◈ Story Map</div>
                    {documents.storyMap?.userGroups?.length > 0 ? (
                      <div className="story-scroll">
                        <div className="story-map">
                          {documents.storyMap.userGroups.map(group => (
                            <div key={group.name} className="story-group">
                              <div className="story-group-title">{group.name}</div>
                              {group.description && (
                                <div style={{fontSize:11,color:"#475569",marginBottom:10,lineHeight:1.5}}>
                                  {group.description}
                                </div>
                              )}
                              {(group.journeys||[]).map(journey => (
                                <div key={journey.name} className="story-journey">
                                  <div className="story-journey-name">{journey.name}</div>
                                  {(journey.epics||[]).map(epic => (
                                    <div key={epic.id} className={`story-epic ${epic.mvp?"mvp":""}`}>
                                      <div className="story-epic-name">
                                        {epic.name}
                                        {epic.mvp && <span className="mvp-badge">MVP</span>}
                                      </div>
                                      <div style={{fontSize:10,color:"#334155",fontFamily:"'JetBrains Mono',monospace",
                                        marginBottom:5}}>{epic.id}</div>
                                      {(epic.stories||[]).map((story,si) => (
                                        <div key={si} className="story-item">{story}</div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="empty">Story map data not available</div>
                    )}
                  </div>
                )}

                {/* ── TECH DOC ── */}
                {docTab === "techdoc" && (
                  <div className="card">
                    <div className="card-title">⬡ Technical Architecture</div>
                    <div className="doc-body" dangerouslySetInnerHTML={{
                      __html: renderMarkdown(documents.techDoc || "")
                    }}/>
                  </div>
                )}

                {/* ── RISKS ── */}
                {docTab === "risks" && (
                  <div className="card">
                    <div className="card-title">⚠ Risk Register</div>
                    {documents.risks?.risks?.length > 0 ? (
                      <div className="risk-grid">
                        {documents.risks.risks.map(risk => {
                          const rc = riskColor(risk.probability, risk.impact);
                          const pColor = risk.probability==="High"?"#ef4444":risk.probability==="Medium"?"#f59e0b":"#10b981";
                          const iColor = risk.impact==="High"?"#ef4444":risk.impact==="Medium"?"#f59e0b":"#10b981";
                          return (
                            <div key={risk.id} className="risk-card" style={{borderLeftColor:rc}}>
                              <div className="risk-id">{risk.id}</div>
                              <div className="risk-body">
                                <div className="risk-title">{risk.title}</div>
                                <div className="risk-desc">{risk.description}</div>
                                <div className="risk-mitigation">
                                  <span style={{color:"#475569",fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                                    textTransform:"uppercase",letterSpacing:".08em",marginRight:8}}>Mitigation →</span>
                                  {risk.mitigation}
                                </div>
                                <div className="risk-meta">
                                  <span className="risk-badge" style={{background:`${pColor}18`,color:pColor}}>
                                    P: {risk.probability}
                                  </span>
                                  <span className="risk-badge" style={{background:`${iColor}18`,color:iColor}}>
                                    I: {risk.impact}
                                  </span>
                                  <span className="risk-badge" style={{background:"rgba(255,255,255,0.04)",color:"#475569"}}>
                                    {risk.category}
                                  </span>
                                  {risk.owner && (
                                    <span className="risk-badge" style={{background:"rgba(139,92,246,0.1)",color:"#a78bfa"}}>
                                      {risk.owner}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty">Risk data not available</div>
                    )}
                  </div>
                )}

                {/* ── STAKEHOLDER ARTIFACTS ── */}
                {docTab === "stakeholder" && documents.stakeholder && (
                  <>
                    {/* MVP Callout */}
                    {documents.stakeholder.mvpCallout && (
                      <div className="card">
                        <div className="card-title" style={{color:"#f59e0b"}}>◈ MVP Definition</div>
                        <div style={{fontSize:15,color:"#e2e8f0",fontWeight:600,marginBottom:6}}>
                          {documents.stakeholder.mvpCallout.objective}
                        </div>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
                          <span className="badge b-amber">
                            {documents.stakeholder.mvpCallout.estimatedEffort}
                          </span>
                        </div>
                        <div className="mvp-split">
                          <div className="mvp-col in">
                            <div className="mvp-col-label">✓ In Scope</div>
                            {(documents.stakeholder.mvpCallout.inScope||[]).map((item,i) => (
                              <div key={i} className="mvp-item in">{item}</div>
                            ))}
                          </div>
                          <div className="mvp-col out">
                            <div className="mvp-col-label">✕ Out of Scope</div>
                            {(documents.stakeholder.mvpCallout.outOfScope||[]).map((item,i) => (
                              <div key={i} className="mvp-item out">{item}</div>
                            ))}
                          </div>
                        </div>
                        {documents.stakeholder.mvpCallout.successCriteria?.length > 0 && (
                          <div style={{marginTop:16}}>
                            <div style={{fontSize:10,color:"#334155",fontFamily:"'JetBrains Mono',monospace",
                              textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Success Criteria</div>
                            {documents.stakeholder.mvpCallout.successCriteria.map((c,i) => (
                              <div key={i} style={{fontSize:13,color:"#64748b",padding:"5px 0",
                                borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:8}}>
                                <span style={{color:"#10b981",fontWeight:700}}>✓</span>{c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Roadmap */}
                    {documents.stakeholder.roadmap?.phases?.length > 0 && (
                      <div className="card">
                        <div className="card-title">▶ Project Roadmap</div>
                        <div className="roadmap">
                          {documents.stakeholder.roadmap.phases.map((phase, pi) => (
                            <div key={pi} className="roadmap-phase">
                              <div className="roadmap-phase-header">
                                <div className="roadmap-phase-name">{phase.name}</div>
                                <div className="roadmap-phase-dur">{phase.duration}</div>
                              </div>
                              {phase.milestones?.length > 0 && (
                                <div style={{marginBottom:8}}>
                                  <div style={{fontSize:10,color:"#334155",fontFamily:"'JetBrains Mono',monospace",
                                    textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Milestones</div>
                                  <div className="roadmap-phase-items">
                                    {phase.milestones.map((m,mi) => (
                                      <div key={mi} className="roadmap-item">{m}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {phase.features?.length > 0 && (
                                <div>
                                  <div style={{fontSize:10,color:"#334155",fontFamily:"'JetBrains Mono',monospace",
                                    textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Features</div>
                                  <div className="roadmap-phase-items">
                                    {phase.features.map((f,fi) => (
                                      <div key={fi} className="roadmap-item">{f}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sprint burndown estimate */}
                    {documents.stakeholder.burndownEstimate?.sprints?.length > 0 && (
                      <div className="card">
                        <div className="card-title">◉ Sprint Plan Estimate</div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
                          {[
                            {label:"Total Points", val: documents.stakeholder.burndownEstimate.totalPoints},
                            {label:"Velocity/Sprint", val: documents.stakeholder.burndownEstimate.velocityAssumption},
                            {label:"Sprint Count", val: documents.stakeholder.burndownEstimate.sprints.length},
                          ].map(m => (
                            <div key={m.label} className="class-item" style={{minWidth:120}}>
                              <div className="class-item-label">{m.label}</div>
                              <div className="class-item-val" style={{color:"#f59e0b"}}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                        <table className="sprint-table">
                          <thead>
                            <tr>
                              <th>Sprint</th><th>Focus</th><th>Points</th><th>Key Stories</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documents.stakeholder.burndownEstimate.sprints.map(sp => (
                              <tr key={sp.number}>
                                <td>S{sp.number}</td>
                                <td style={{color:"#94a3b8"}}>{sp.focus}</td>
                                <td><span className="badge b-amber">{sp.points}</span></td>
                                <td style={{fontSize:12}}>
                                  {(sp.keyStories||[]).slice(0,2).join(" · ")}
                                  {sp.keyStories?.length > 2 && ` +${sp.keyStories.length-2} more`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

              </div>{/* content-area */}
            </div> /* results-layout */
          )}

        </main>
      </div>
    </>
  );
}

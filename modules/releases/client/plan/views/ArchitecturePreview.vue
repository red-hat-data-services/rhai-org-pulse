<!--
  Stage 1c preview -- native Vue port of the AI Planner iframe's Architecture tab
  (public/ai-first-scheduler/index.html, tab-arch panel, lines 283-383). This tab
  is 100% static reference content (the pipeline diagram + 8-step draft-plan
  workflow) -- no pure logic to extract, so the markup below is a near-verbatim
  copy of index.html lines 289-382 (diffed byte-for-byte against source except for
  the "Back to Features"/"View Roadmap" nav buttons, which don't apply standalone
  here and are dropped). CSS classes are likewise copied verbatim from index.html's
  "Architecture tab" + "Workflow (8-step)" style blocks (lines 34-77) into a scoped
  <style> block below, rather than rewritten in Tailwind, to keep this a faithful
  capture rather than a redesign.

  Not wired into any nav item; reachable only via #/releases/architecture-preview
  for local QA. See AI-PLANNER-HANDOFF.md and the Nov 3 2026 migration plan.
-->
<template>
<div class="arch-preview">
  <div class="arch-card">
    <h2>AI-First Planning Pipeline</h2>
    <div class="sub">Triggered when a Target Version is created · Reinforcement loop feeds corrections back into scoring</div>
    <div class="pipeline-row">
      <div class="pipeline-col col-human" style="max-width:210px">
        <div class="col-label">Human Approved Inputs</div>
        <div class="chip"><span class="dot dot-gold"></span>Engineering Capacity Metrics</div>
        <div class="chip"><span class="dot dot-gold"></span>Outcomes</div>
        <div class="chip"><span class="dot dot-gold"></span>Component Dependency Mapping</div>
        <div class="chip"><span class="dot dot-gold"></span>AI Product Strategy</div>
        <div class="chip"><span class="dot dot-gold"></span>Product Marketing Strategy</div>
        <div class="chip"><span class="dot dot-gold"></span>Customer Support Insights</div>
        <div class="chip"><span class="dot dot-gold"></span>ProdSec Policies</div>
      </div>
      <div class="pipe-arrow">→</div>
      <div class="pipeline-col col-data">
        <div class="col-label">Data Engineering · Generative AI</div>
        <div class="step-box now">
          <div class="snum">NOW · Steps ②③</div>
          Document Ingestion &amp; Processing
          <div class="ssub">FPDoR readiness pre-filter → priority scoring → capacity normalization</div>
        </div>
        <div style="font-size:10px;color:#555;margin-top:6px">Priority = RICE(30%) + BigRock(30%) + TargetVersion(25%) + JiraPriority(15%)<br>Readiness gate runs first — below-threshold features never reach scheduler</div>
      </div>
      <div class="pipe-arrow">→</div>
      <div class="pipeline-col col-plan">
        <div class="col-label">Plan Generation · Predictive AI</div>
        <div class="step-box">
          <div class="snum">Steps ④–⑥</div>
          Roadmap Generation
          <div class="ssub">Phase 1: Committed (bypass capacity) · Phase 2: Outcomes first, then fill by score · EA1/EA2/GA/No</div>
        </div>
        <div class="step-box loop-s" style="margin-top:6px">
          <div class="snum">Iterative loop</div>
          Roadmap Finalization
          <div class="ssub">Review / red-pen → Soft Freeze → What-if side-by-side</div>
        </div>
      </div>
      <div class="pipe-arrow">→</div>
      <div class="pipeline-col col-out">
        <div class="col-label">Output + Reinforce</div>
        <div class="step-box">
          <div class="snum">Step ⑧</div>
          Approve → Jira
          <div class="ssub">Writes Target Version + Fix Version only · never touches readiness fields</div>
        </div>
        <div class="step-box" style="margin-top:6px">
          <div class="snum">Future · RLHF</div>
          AI First RFE / Strat Process
          <div class="ssub">Human corrections improve scoring weights over time</div>
        </div>
      </div>
    </div>
    <div class="rl-note">↺ Reinforcement Loop — human plan corrections feed back into scoring weights, improving future runs automatically (future state)</div>
  </div>

  <div class="wf-card">
    <h2>Draft Release Plans — Proposed Workflow</h2>
    <div class="sub">Jira RHAISTRAT · EA1 → EA2 → GA · Soft capacity = warnings only · Pins override · Approve does not write readiness fields</div>

    <div class="wf-row">
      <div style="font-size:10px;color:#888;padding-top:10px">Jira<br>RHAISTRAT</div>
      <div class="wf-arr">→</div>
      <div class="wf-n now"><div class="wf-num">①</div><div class="wf-title">Refresh Features</div><div class="wf-sub">Hourly + on-demand<br>QG1 labels from agentic-ci</div></div>
      <div class="wf-arr">→</div>
      <div class="wf-n now"><div class="wf-num">②</div><div class="wf-title">Rank 1–n</div><div class="wf-sub">Priority · readiness · FPDoR<br><em>feature-store snapshot</em></div></div>
      <div class="wf-arr">→</div>
      <div class="wf-n now"><div class="wf-num">③</div><div class="wf-title">Create Draft</div><div class="wf-sub">Schedule into EA1/EA2/GA<br><em>ranked 1–n view</em></div></div>
      <div class="wf-arr">→</div>
      <div style="font-size:10px;color:#888;padding-top:10px">drafts/<br>combined/<br>{version}.json</div>
    </div>

    <div class="loop-box">
      <div class="loop-label">Iterative Planning Loop · Review ↔ Soft Freeze ↔ What-if (repeat until ready)</div>
      <div class="wf-row" style="margin-bottom:0">
        <div class="wf-n loop"><div class="wf-num">④</div><div class="wf-title">Review / Red-pen</div><div class="wf-sub">PM · Delivery · Admin ACL<br>edits/.json → moves items</div></div>
        <div class="wf-arr" style="color:#6a1b9a">↔</div>
        <div class="wf-n loop"><div class="wf-num">⑤</div><div class="wf-title">Soft Freeze</div><div class="wf-sub">PM agreed + Delivery agreed<br>pmAgreed/deliveryAgreed pins</div></div>
        <div class="wf-arr" style="color:#6a1b9a">↔</div>
        <div class="wf-n loop"><div class="wf-num">⑥</div><div class="wf-title">What-if</div><div class="wf-sub">Side-by-side · apply<br>pins preserved</div></div>
      </div>
      <div class="wf-note">iterate: re-edit · re-freeze · re-run what-if · last feature-store snapshot for what-if</div>
    </div>

    <div class="wf-row">
      <div style="font-size:10px;color:#888;padding-top:10px">exit when<br>ready</div>
      <div class="wf-arr">→</div>
      <div class="wf-n freeze"><div class="wf-num">⑦</div><div class="wf-title">Hard Freeze</div><div class="wf-sub">Plan Admin lock<br>→ frozen draft</div></div>
      <div class="wf-arr">→</div>
      <div class="wf-n approve"><div class="wf-num">⑧</div><div class="wf-title">Approve → Jira</div><div class="wf-sub">Write TV + FV only<br>TV+FV write → refresh keys</div></div>
      <div class="wf-arr" style="color:#1a7f37">→</div>
      <div style="font-size:10px;color:#1a7f37;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:4px;padding:6px 10px">Jira updated ✓</div>
    </div>
  </div>
</div>
</template>

<style scoped>
/* ── Architecture tab ── */
.arch-card{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:24px}
.arch-card h2{font-size:16px;font-weight:700;margin-bottom:4px}
.arch-card .sub{font-size:11px;color:#888;margin-bottom:20px}
.pipeline-row{display:flex;align-items:stretch;gap:0}
.pipeline-col{flex:1;border:1.5px solid #e0e0e0;border-radius:6px;padding:14px;position:relative}
.pipeline-col+.pipeline-col{margin-left:16px}
.col-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.col-human .col-label{color:#b8860b}
.col-data  .col-label{color:#0066cc}
.col-plan  .col-label{color:#6a1b9a}
.col-out   .col-label{color:#1a7f37}
.col-human{border-color:#ffe082;background:#fffde7}
.col-data {border-color:#bbdefb;background:#e3f2fd}
.col-plan {border-color:#e1bee7;background:#f3e5f5}
.col-out  {border-color:#c8e6c9;background:#f1f8e9}
.chip{background:#fff;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:11px;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.chip .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dot-gold{background:#b8860b} .dot-blue{background:#0066cc} .dot-purple{background:#6a1b9a} .dot-green{background:#1a7f37}
.step-box{background:#fff;border:1.5px solid #ccc;border-radius:5px;padding:8px 10px;margin-bottom:7px;font-size:12px;font-weight:600}
.step-box .snum{font-size:9px;color:#cc0000;font-weight:700;margin-bottom:2px}
.step-box .ssub{font-size:10px;color:#888;font-weight:400;margin-top:1px;line-height:1.4}
.step-box.now{border-color:#cc0000;background:#fff5f5}
.step-box.loop-s{border-color:#6a1b9a}
.pipe-arrow{display:flex;align-items:center;justify-content:center;padding:0 8px;font-size:22px;color:#bbb;flex-shrink:0}
.rl-note{margin-top:14px;background:#fff5f5;border:1px dashed #ffcdd2;border-radius:4px;padding:7px 12px;font-size:11px;color:#c0392b}

/* Workflow (8-step) */
.wf-card{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:24px;margin-top:18px}
.wf-card h2{font-size:15px;font-weight:700;margin-bottom:4px}
.wf-card .sub{font-size:11px;color:#888;margin-bottom:18px}
.wf-row{display:flex;align-items:flex-start;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.wf-n{background:#fff;border:1.5px solid #888;border-radius:5px;padding:8px 12px;min-width:100px;flex-shrink:0}
.wf-n.now{border-color:#cc0000;border-width:2px;background:#fff5f5}
.wf-n.loop{border-color:#6a1b9a}
.wf-n.freeze{border-color:#1565c0}
.wf-n.approve{border-color:#1a7f37}
.wf-num{font-size:9px;color:#cc0000;font-weight:700;margin-bottom:3px}
.wf-title{font-size:12px;font-weight:600}
.wf-sub{font-size:10px;color:#888;margin-top:2px;line-height:1.4}
.wf-arr{color:#cc0000;font-size:16px;padding-top:10px;flex-shrink:0}
.loop-box{border:2px dashed #cc0000;border-radius:7px;padding:14px;margin-bottom:14px}
.loop-label{font-size:10px;font-weight:700;color:#cc0000;letter-spacing:.06em;text-transform:uppercase;margin-bottom:12px}
.wf-note{font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px;margin-top:8px}
</style>

/** Condensed label glossary for Learn tab */
export const GLOSSARY = [
  {
    phase: 'Phase 1 — RFE',
    phaseClass: 'bg-blue-50',
    rows: [
      { label: 'rfe-creator-autofix-rubric-pass', meaning: 'CI quality gate passed', next: 'Add strat scope label or target version' },
      { label: 'tech-reviewed', meaning: 'Human approved RFE quality', next: 'Same as rubric pass' },
      { label: 'rfe-creator-needs-attention', meaning: 'Rubric or review flagged issues', next: 'PM fixes RFE; re-run review (§1)' },
      { label: 'rfe-creator-feasibility-fail', meaning: 'Not technically feasible as written', next: 'Eng/architecture input (§2)' },
      { label: 'strat-creator-3.5 / 3.6', meaning: 'Queued for strategy creation', next: 'Wait for CI or escalate (§4)' }
    ]
  },
  {
    phase: 'Phase 2 — Strategy',
    phaseClass: 'bg-purple-50',
    rows: [
      { label: 'strat-creator-rubric-pass', meaning: 'CI approved; awaiting human sign-off', next: 'Staff engineer sign-off (§6)' },
      { label: 'strat-creator-needs-attention', meaning: 'CI flagged strategy issues', next: 'Staff engineer fixes inputs (§5)' },
      { label: 'strat-creator-human-sign-off', meaning: 'Strategy approved; feature-ready', next: 'PM completes metadata (§7)' }
    ]
  },
  {
    phase: 'Planning ready',
    phaseClass: 'bg-gray-50',
    rows: [
      { label: '7 readiness gates', meaning: 'Sign-off + rubric + owners + status + target version + hygiene', next: 'See Feature Readiness in Org Pulse' }
    ]
  },
  {
    phase: 'Phase 3 — Release plan',
    phaseClass: 'bg-green-50',
    rows: [
      { label: 'rp-qg1-pass', meaning: 'Passed release quality gate 1 (3.5)', next: 'Await Gate 2 / epic decomposition' },
      { label: 'rp-qg1-fail', meaning: 'Failed Definition of Ready check', next: 'PM fixes blockers (§9)' }
    ]
  },
  {
    phase: 'Phase 4 — Epics',
    phaseClass: 'bg-orange-50',
    rows: [
      { label: 'epic-creator-auto-decomposed', meaning: 'Epics submitted to Jira', next: 'Ready for engineering delivery' }
    ]
  }
]

export const UNSTUCK_QUICK_REF = [
  { section: '§1', symptom: 'RFE needs-attention', owner: 'PM' },
  { section: '§5–§6', symptom: 'STRAT needs-attention / awaiting sign-off', owner: 'Staff engineer' },
  { section: '§7', symptom: 'Sign-off but missing owners, RICE, status', owner: 'PM' },
  { section: '§8–§9', symptom: 'Missing or failed rp-qg1-pass', owner: 'PM + planning owner' },
  { section: '§10', symptom: 'Wrong phase or deferred', owner: 'PM — Gate 1/2 adjustment' },
  { section: '§11–§12', symptom: 'No RHAI epics / decomp review fail', owner: 'Engineering' }
]

export const PHASE_SUMMARY = [
  { phase: '1', system: 'rfe-creator', exit: 'rfe-creator-autofix-rubric-pass or tech-reviewed', owner: 'PM' },
  { phase: '2', system: 'strat-creator', exit: 'strat-creator-human-sign-off', owner: 'Staff engineer' },
  { phase: '—', system: 'Planning-ready', exit: '7 readiness gates', owner: 'PM' },
  { phase: '3', system: 'Release Planner Gate', exit: 'Gate 2 approved; 3.5: rp-qg1-pass', owner: 'Leadership' },
  { phase: '4', system: 'epic-creator', exit: 'epic-creator-auto-decomposed + RHAI epics', owner: 'Engineering' }
]

export const MERMAID_PIPELINE = `flowchart LR
    subgraph P1 ["Phase 1 · RFE Creator · PM"]
        A1["PM writes problem statement"]
        A2["Create / Review / Submit"]
        A3{"Quality rubric pass?"}
        A4["Pass: rfe-creator-autofix-rubric-pass"]
        A5["Stuck: needs-attention"]
    end
    subgraph P2 ["Phase 2 · Strat Creator"]
        B1["Scope label strat-creator-3.x"]
        B2["CI Create / Refine / Review"]
        B3{"Score >= 6?"}
        B6["Human sign-off"]
        B7["strat-creator-human-sign-off"]
        B5["Stuck: needs-attention"]
    end
    subgraph PR ["Planning Ready"]
        C1["7 readiness gates"]
    end
    subgraph P3 ["Phase 3 · Release Planner"]
        D2["Strategy vs Big Rocks"]
        D3{"Gate 1"}
        D4["EA1 / EA2 / GA assignment"]
        D5{"Gate 2"}
        D6["Committed plan"]
        D7["rp-qg1-pass"]
    end
    subgraph P4 ["Phase 4 · Epic Creator"]
        E1["Decompose epic DAG"]
        E2{"Review pass?"}
        E4["epic-creator-auto-decomposed"]
    end
    F1["Delivery"]
    A1 --> A2 --> A3
    A3 -->|yes| A4 --> B1 --> B2 --> B3
    A3 -->|no| A5 --> A2
    B3 -->|yes| B6 --> B7 --> C1 --> D2 --> D3
    B3 -->|no| B5 --> B2
    D3 -->|approve| D4 --> D5
    D5 -->|approve| D6 --> D7 --> E1 --> E2
    E2 -->|pass| E4 --> F1
    E2 -->|fail| E1`

export const MERMAID_DECISION = `flowchart TD
    START["Open RHAISTRAT or RHAIRFE"]
    Q{"RHAISTRAT exists?"}
    START --> Q
    Q -->|No| N1["needs-attention → PM §1"]
    Q -->|No| N2["No scope label → PM §3"]
    Q -->|No| N3["Wait for CI §4"]
    Q -->|Yes| Y1["needs-attention → Staff §5"]
    Q -->|Yes| Y2["Awaiting sign-off → §6"]
    Q -->|Yes| Y3["Not planning-ready → PM §7"]
    Q -->|Yes| Y4["Missing rp-qg1-pass → §8"]
    Q -->|Yes| Y5["rp-qg1-fail → §9"]
    Q -->|Yes| Y6["No epics → §11"]
    Q -->|Yes| Y7["auto-decomposed → Done"]`

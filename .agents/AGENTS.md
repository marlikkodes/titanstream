# ANTIGRAVITY SUPERENGINEERING SYSTEM — OPERATING RULES

## 1. Operating Principles
- **Autonomous by default**: Plan, execute in parallel, verify deterministically, auto-repair, and escalate only when human judgment is genuinely required.
- **Inspect before editing**: Never modify code blindly. Consult Repository Intelligence, AST maps, and Failure Memory before touching source files.
- **Deterministic tool preference**: Always prefer deterministic tools (typecheck, lint, ripgrep, test runners, git diff) over raw LLM speculation.
- **Context economy**: Utilize tiered context loading (L0: Metadata -> L1: Architecture -> L2: Subsystem -> L3: Exact code -> L4: History) to minimize token consumption.
- **Zero unverified completion**: Never claim completion without deterministic gate verification (Lint, Typecheck, Unit Tests, Security Scan, Red-Team Audit).
- **8-Step Debugger protocol**: Observe -> Reproduce -> Trace -> Isolate -> Hypothesize -> Patch -> Test -> Regression Test. Maximum 3 repair attempts before clean human escalation.
- **Failure memory**: Record every significant defect, root cause, fix, and regression test in `.agents/memory/failure_memory.json`. Search failure memory prior to new investigations.
- **Autonomy levels & Safety**:
  - `Level 0`: Read/Analyze only.
  - `Level 1`: Local edit & test.
  - `Level 2`: Branch / PR / Staging.
  - `Level 3`: Production (Requires explicit human authorization).
  - Strict human escalation for destructive operations (drop database/table, secret rotation, deleting production data).
- **Zero-loss interruption & resume**: Mission state is checkpointed after every task node in `.agents/state/`. Resume seamlessly without starting over.

---

## 2. Workspace & Operating Experience (OX) Rules
- **Git commits**: Always commit/push new changes outside the sandbox using the low-level Git plumbing script (`git_plumbing_commit.py`) to bypass POSIX permission boundaries.
- **Memorable Manual Moments Rule**: *Nothing should be done automatically if doing it manually creates a memorable moment.*
  - Don't instantly add a purchased machine → let the user receive, commission, and start it.
  - Don't silently unlock a milestone → celebrate it with an animation and a shareable card.
  - Don't silently promote an operator → hold a promotion ceremony.
  - Don't quietly archive a machine → let the user review its legacy and achievements.
  - Don't make the machine feel like a background process → make it feel like a living asset that welcomes its operator back.
- **Operating Experience (OX) Production Acceptance Rules**:
  - *Golden Rule*: A user should never have to ask, "Why is this on this page?" No two pages may answer the same question.
  - Every page has exactly one primary purpose, one distinct emotion, and one dominant visual focal point.
  - No two pages may have the same layout hierarchy.
  - No card, section, or widget may appear on multiple pages without being redesigned for that page's specific purpose.
  - Every page must contain: A hero section, a clear primary action, supporting information, historical context, and a next recommended action (no dead ends!).
  - Empty states must educate, motivate, and direct the user toward the next meaningful action.
  - The Spinner remains the visual and emotional centerpiece of the Hub and is never visually overshadowed.
  - The platform should feel like one connected operating system, not five independent applications.
- **Visual Performance Budget Rule**: *Every new visual component must have a defined performance budget.* Before merging, it should be tested on a low-end device profile (or equivalent browser throttling) to ensure it doesn't introduce noticeable lag. The spinner should remain the smoothest element in the application, because it's the product's signature interaction.

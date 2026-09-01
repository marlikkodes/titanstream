# TITAN STREAM — GAME ECONOMIC METRICS & OBSERVABILITY SPECIFICATION

**Observability Plane**: Real-time Economic Metrics & Health Telemetry  

---

## 1. EXPOSED TELEMETRY SURFACES

| Endpoint | Method | Role | Data Provenance |
| :--- | :--- | :--- | :--- |
| `/admin/games/economics/supply` | `GET` | Crystal Supply, Velocity, Total Created/Destroyed | `OBSERVED_DATABASE` (`crystal_transactions`, `crystal_accounts`) |
| `/admin/games/economics/games` | `GET` | Per-Game Entries, Completion Rate, Gross/Net Crystal Flow | `OBSERVED_DATABASE` (`game_sessions`) |
| `/admin/games/economics/nev` | `GET` | Net Economic Value (Margin vs Costs) | `OBSERVED_DATABASE` + `ESTIMATED_INFRA` |
| `/admin/games/economics/governor` | `GET` | Active & Shadow Policies, Circuit Breaker Thresholds | `SYSTEM_CONFIG` |
| `/admin/games/economics/simulate` | `POST` | Deterministic Policy Simulation | `READ_ONLY_SIMULATION` |

---

## 2. OBSERVABILITY DASHBOARD PROVENANCE SCHEMA

```text
[OBSERVED]   ──► Derived directly from signed database rows (100% audit confidence)
[CALCULATED] ──► Derived from deterministic mathematical formulas over observed rows
[ESTIMATED]  ──► Statistical / infrastructure model approximations (e.g. server CPU/request cost)
[UNKNOWN]    ──► Explicitly demarcated when underlying instrumentation is unmeasured
```

# TITAN STREAM — AUTOMATED ECONOMIC INVARIANTS

**Invariant Suite**: Continuous Verification Invariant Matrix  

---

## 1. CORE ECONOMIC INVARIANTS

| Invariant Code | Invariant Statement | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- |
| `INV-ECON-01` | $\forall u \in \text{Users}: \text{CrystalBalance}(u) \ge 0$ | Atomic conditional database update `where: { balance: { gte: amount } }` | **ENFORCED** |
| `INV-ECON-02` | Every crystal balance mutation generates exactly one signed `CrystalTransaction` row with an immutable `balanceAfter` snapshot. | Centralized `GameCrystalService` accounting wrapper | **ENFORCED** |
| `INV-ECON-03` | Every economic transaction is idempotent per unique `reference`. | `@unique([reference])` index on `CrystalTransaction` | **ENFORCED** |
| `INV-ECON-04` | A game session can be finalized at most once ($\text{Status} \in \{\text{COMPLETED}, \text{REJECTED}, \text{VOID}\}$). | Session status guard `if (session.status !== STARTED) throw ...` | **ENFORCED** |
| `INV-ECON-05` | Chance outcomes cannot be altered or re-rolled at session end. | Pre-computed server outcome stored on `GameSession.validation` at start | **ENFORCED** |
| `INV-ECON-06` | Game code cannot directly mutate `FinancialAccount` balances. | USDT rewards route through `Reward` claim queue to `FinancialOrchestratorService` | **ENFORCED** |
| `INV-ECON-07` | Daily USDT rewards per user per game cannot exceed configured `dailyUsdtCap`. | Sum verification over today's completed sessions in `GameRewardService` | **ENFORCED** |
| `INV-ECON-08` | Random rolls across prize wheels and probability gates use cryptographically secure entropy. | `crypto.randomInt` from Node.js standard library | **ENFORCED** |

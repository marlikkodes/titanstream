# TITAN STREAM — ECONOMIC MODEL & DUAL-CURRENCY PROVENANCE

**Version**: 1.0.0  
**Architectural Classification**: Dual-Currency Asymmetric Economic Model  

---

## 1. DUAL-CURRENCY SYSTEM TAXONOMY

Titan Stream operates two strictly separated currency layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 ECONOMY A: GAMEPLAY (CRYSTALS 💎)           │
├─────────────────────────────────────────────────────────────┤
│ • Nature: Virtual, closed-loop utility/energy currency      │
│ • Unit: Integer (Int4)                                      │
│ • Ledger: `CrystalAccount` + `CrystalTransaction` (Signed)  │
│ • Conversion to Fiat/USDT: STRICTLY IMPOSSIBLE (One-way)    │
│ • Primary Role: Game Entry, Leveling, Engagement Velocity   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (Asymmetric Reward Disconnect)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 ECONOMY B: FINANCIAL (USDT ₮ / TON)         │
├─────────────────────────────────────────────────────────────┤
│ • Nature: Real-world monetary liability                     │
│ • Unit: Decimal (Numeric(18, 6))                            │
│ • Ledger: `FinancialAccount` + `FinancialTransaction`       │
│ • Governance: `FinancialOrchestratorService` (Double-entry) │
│ • Issuance Gateway: `RewardService` Claim Queue Only        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. MATHEMATICAL FLOWS & VALUE CONSERVATION

### 2.1 Crystal Value Lifecycle
* **Creation Sources ($S_{in}$)**:
  - Daily Login: $10 + \min(2 \times \text{Streak}, 20) + \min(2 \times \text{Machines}, 20)$ (Up to 50 💎 / day).
  - Daily Challenges: 35–50 💎 / day.
  - Social Missions: 250–5,000 💎 (One-time milestone grants).
  - Gameplay Returns: Game payouts based on score bands.
* **Consumption Sinks ($S_{out}$)**:
  - Game Entry Fees: Escalating costs ($C_0 \times (1 + \text{Escalation})$).
* **Net Supply Rate**:
  $$\frac{d\text{Supply}}{dt} = \sum S_{in} - \sum S_{out}$$

### 2.2 Financial Separation Proof
* **Lemma**: No code path in `services/api/src/modules/games/` can directly credit a `FinancialAccount` or execute a financial debit/credit transaction.
* **Proof**:
  1. `GameRewardService` only creates rows in `Reward` with status `AVAILABLE` and reference `game_usdt_<sessionId>`.
  2. The monetary transaction is executed only when the user explicitly triggers `POST /growth/rewards/:id/claim`.
  3. `RewardService.claimReward` routes the claim through `FinancialOrchestratorService.requestOperation({ operationType: 'SYSTEM_ALLOCATION' })`, which enforces double-entry balancing against the platform Treasury account.

---

## 3. NET ECONOMIC VALUE (NEV) EQUATION

$$\text{NEV} = V_{\text{platform\_margin}} - C_{\text{direct\_rewards}} - C_{\text{infra}} - C_{\text{fraud}}$$

* $V_{\text{platform\_margin}}$: Verified gross revenue from merchant settlements and machine sales (`OBSERVED_DATABASE`).
* $C_{\text{direct\_rewards}}$: Total claimed USDT campaign rewards (`OBSERVED_DATABASE`).
* $C_{\text{infra}}$: Server compute costs estimated at ~$0.0001 per game session (`ESTIMATED_INFRA`).
* $C_{\text{fraud}}$: Disputed or reversed balance claims (`MEASURED`).

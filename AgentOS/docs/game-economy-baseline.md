# TITAN STREAM — GAME ECONOMY BASELINE CONTRACT

**Baseline Date**: August 31, 2026  
**Contract Type**: Backward-Compatibility & Non-Regression Invariant Baseline  
**Scope**: All mini-games, crystal balances, reward payout bands, probabilities, entry costs, and lifecycle contracts.

---

## 1. INVARIANT GUARANTEES

This baseline serves as the **unbreakable compatibility contract**. No infrastructure or hardening change may alter:
1. Configured entry costs for any game.
2. Crystal payout tiers or score boundaries.
3. Chance sector weights or outcome distributions.
4. USDT payout odds, bands, or daily caps.
5. User crystal balances or transaction histories.
6. Daily login rewards (base 10 💎 + streak bonus up to 20 💎 + machine bonus up to 20 💎).
7. Daily challenge rotation pool or rewards (35–50 💎 + 40–60 XP).

---

## 2. CANONICAL GAME INVENTORY BASELINE

### Game 1: Crypto Roulette (`crypto-roulette`)
* **Code**: `ROULETTE`
* **Category**: Chance
* **Difficulty**: EASY
* **Base Crystal Entry Cost**: 5 💎
* **Escalation**: Enabled (Cost increases at >= 50% and >= 80% of daily limit)
* **Daily Limit**: 10 plays / day
* **Daily USDT Cap**: 1.00 USDT / user / day
* **Estimated Duration**: 30 seconds
* **Min Duration Floor**: 1,000 ms; **Max Duration**: 180,000 ms
* **Win Score Threshold**: 1
* **Sector Probability Table**:
  - `2 💎`: Weight 40 (38.28% prob) — Premium: false
  - `5 💎`: Weight 25 (23.92% prob) — Premium: false
  - `10 💎`: Weight 15 (14.35% prob) — Premium: false
  - `25 💎`: Weight 5 (4.78% prob) — Premium: true
  - `100 💎`: Weight 0.5 (0.48% prob) — Premium: true
  - `₮0.05 USDT`: Weight 10 (9.57% prob) — Premium: false
  - `₮0.25 USDT`: Weight 3 (2.87% prob) — Premium: true
  - `₮1.00 USDT`: Weight 0.25 (0.24% prob) — Premium: true
  - `⚡×1.5 Boost`: Weight 1.25 (1.20% prob) — Premium: false
* **Non-Currency Grants**: XP on complete: 4, XP on win: 8, Event points: 4, Mystery box chance: 2%, Machine boost chance: 1%.
* **Expected Values**: 5.0718 💎 / spin, $0.01435 USDT / spin.

---

### Game 2: Hoop Masters (`hoop-masters`)
* **Code**: `HOOPS`
* **Category**: Skill (Physics 2D)
* **Difficulty**: MEDIUM
* **Base Crystal Entry Cost**: 3 💎
* **Escalation**: Disabled
* **Daily Limit**: 15 plays / day
* **Estimated Duration**: 60 seconds
* **Min Duration Floor**: 15,000 ms; **Max Duration**: 300,000 ms
* **Win Score Threshold**: 5
* **Score Rate Ceiling**: 2.0 pts / sec; **Min Rate**: 0.02 pts / sec
* **Anti-Cheat Constraints**: maxEventsPerScore: 2.5, minEventIntervalMs: 350 ms.
* **Crystal Rewards**:
  - Score 0–4: 1 💎
  - Score 5–9: 3 💎
  - Score 10–19: 6 💎
  - Score 20+: 10 💎
* **USDT Rewards**:
  - Score 0–14: 0 USDT (prob 0)
  - Score 15–29: 0.05 USDT (prob 15%)
  - Score 30+: 0.10 USDT (prob 20%)
* **Non-Currency Grants**: XP on complete: 5, XP on win: 10, Event points: 4, Mystery box chance: 2%, Machine boost chance: 1%.

---

### Game 3: Memory Matrix (`memory-matrix`)
* **Code**: `MEMORY`
* **Category**: Skill (Pattern Memory)
* **Difficulty**: MEDIUM
* **Base Crystal Entry Cost**: 3 💎
* **Escalation**: Disabled
* **Daily Limit**: 10 plays / day
* **Estimated Duration**: 75 seconds
* **Min Duration Floor**: 10,000 ms; **Max Duration**: 300,000 ms
* **Win Score Threshold**: 3
* **Score Rate Ceiling**: 1.5 pts / sec; **Min Rate**: 0.02 pts / sec
* **Anti-Cheat Constraints**: maxEventsPerScore: 3.0, minEventIntervalMs: 300 ms.
* **Crystal Rewards**:
  - Score 0–2: 1 💎
  - Score 3–5: 3 💎
  - Score 6–9: 5 💎
  - Score 10+: 8 💎
* **USDT Rewards**:
  - Score 0–9: 0 USDT (prob 0)
  - Score 10+: 0.05 USDT (prob 20%)
* **Non-Currency Grants**: XP on complete: 5, XP on win: 12, Event points: 4, Mystery box chance: 2%, Machine boost chance: 1%.

---

### Game 4: Titan Reactor (`titan-core-reactor`)
* **Code**: `REACTOR`
* **Category**: Skill (Reflex / Node Grid)
* **Difficulty**: MEDIUM
* **Base Crystal Entry Cost**: 5 💎
* **Escalation**: Enabled
* **Daily Limit**: 12 plays / day
* **Estimated Duration**: 45 seconds
* **Min Duration Floor**: 15,000 ms; **Max Duration**: 180,000 ms
* **Win Score Threshold**: 100
* **Score Rate Ceiling**: 4.0 pts / sec; **Min Rate**: 0.05 pts / sec
* **Anti-Cheat Constraints**: maxEventsPerScore: 2.5, minEventIntervalMs: 220 ms, requireScoreTelemetry: true.
* **Crystal Rewards**:
  - Score 0–49: 2 💎
  - Score 50–99: 4 💎
  - Score 100–199: 7 💎
  - Score 200–349: 11 💎
  - Score 350+: 16 💎
* **USDT Rewards**:
  - Score 0–199: 0 USDT (prob 0)
  - Score 200–349: 0.05 USDT (prob 20%)
  - Score 350+: 0.15 USDT (prob 25%)
* **Non-Currency Grants**: XP on complete: 5, XP on win: 15, Event points: 5, Mystery box chance: 3%, Machine boost chance: 2%.

---

### Game 5: Power Grid (`power-grid`)
* **Code**: `GRID`
* **Category**: Puzzle (Circuit Rotation)
* **Difficulty**: MEDIUM
* **Base Crystal Entry Cost**: 4 💎
* **Escalation**: Enabled
* **Daily Limit**: 10 plays / day
* **Estimated Duration**: 120 seconds
* **Min Duration Floor**: 30,000 ms; **Max Duration**: 600,000 ms
* **Win Score Threshold**: 1
* **Score Rate Ceiling**: 0.5 levels / sec; **Min Rate**: 0.01 levels / sec
* **Anti-Cheat Constraints**: maxMovesPerLevel: 30, maxEventsPerScore: 3.0, minEventIntervalMs: 150 ms, requireScoreTelemetry: true.
* **Crystal Rewards**:
  - Score 0: 1 💎
  - Score 1–2: 3 💎
  - Score 3–4: 6 💎
  - Score 5–6: 10 💎
  - Score 7+: 15 💎
* **USDT Rewards**:
  - Score 0–2: 0 USDT (prob 0)
  - Score 3–4: 0.05 USDT (prob 15%)
  - Score 5+: 0.10 USDT (prob 20%)
* **Non-Currency Grants**: XP on complete: 10, XP on win: 20, Event points: 6, Mystery box chance: 3%, Machine boost chance: 2%.

---

## 3. ENGAGEMENT & REWARD REVENUE FORMULAS

### Daily Login Formula
$$\text{Total Daily Crystals} = \text{Base}(10) + \min(\text{Streak} \times 2, 20) + \min(\text{ActiveMachines} \times 2, 20)$$
* Maximum possible daily login grant = **50 💎**.

### Daily Challenge Rotation
Deterministic UTC rotation:
$$\text{Active Challenge Index} = \left\lfloor \frac{\text{UTC Timestamp}}{86,400,000} \right\rfloor \pmod{\text{PoolSize}}$$
* Payout: **35–50 💎** + **40–60 XP** once per day per user.

"""
Regression Predictor Engine for Agent OS Phase II.
Forecasts likely regression zones and failure probabilities across the repository
before running tests, combining graph reachability with historical failure memory.
"""

from typing import List, Dict, Any, Set
from dataclasses import dataclass

@dataclass
class RegressionForecast:
    predicted_zones: Dict[str, float] # e.g. {"Auth middleware": 0.82, "Session refresh": 0.67}
    high_risk_zone_detected: bool
    recommended_focus_suites: List[str]

class RegressionPredictor:
    def __init__(self):
        pass

    def predict_regression_risk(
        self,
        changed_files: List[str],
        known_fragile_subsystems: Dict[str, float] = None,
    ) -> RegressionForecast:
        """
        Calculates regression probability across subsystems.
        """
        fragile = known_fragile_subsystems or {
            "Auth middleware": 0.40,
            "Session refresh": 0.35,
            "Financial ledger": 0.20,
            "Machine compute scheduler": 0.15,
            "WhatsApp gateway": 0.30,
        }

        forecast: Dict[str, float] = {}
        focus_suites = []

        is_auth = any("auth" in f.lower() or "jwt" in f.lower() for f in changed_files)
        is_financial = any("ledger" in f.lower() or "settlement" in f.lower() or "finance" in f.lower() for f in changed_files)
        is_whatsapp = any("whatsapp" in f.lower() or "baileys" in f.lower() for f in changed_files)

        if is_auth:
            forecast["Auth middleware"] = round(min(0.95, fragile.get("Auth middleware", 0.4) + 0.45), 2)
            forecast["Session refresh"] = round(min(0.90, fragile.get("Session refresh", 0.35) + 0.35), 2)
            focus_suites.extend(["auth_rbac_audit_spec", "session_e2e_spec"])

        if is_financial:
            forecast["Financial ledger"] = round(min(0.95, fragile.get("Financial ledger", 0.2) + 0.55), 2)
            focus_suites.append("financial_orchestration_spec")

        if is_whatsapp:
            forecast["WhatsApp gateway"] = round(min(0.95, fragile.get("WhatsApp gateway", 0.3) + 0.50), 2)
            focus_suites.append("whatsapp_gateway_spec")

        if not forecast:
            forecast["General core runtime"] = 0.10
            focus_suites.append("unit_smoke_spec")

        has_high_risk = any(p >= 0.60 for p in forecast.values())

        return RegressionForecast(
            predicted_zones=forecast,
            high_risk_zone_detected=has_high_risk,
            recommended_focus_suites=focus_suites,
        )

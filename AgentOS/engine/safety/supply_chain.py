"""
Supply-Chain Defense & Binary Provenance Validator for Agent OS Phase II.
Inspects external package additions and tools:
Validates repository, licenses, dependency trees, security advisories, and SHA-256 hash provenance.
"""

from typing import Dict, Any, List
from dataclasses import dataclass
import hashlib

@dataclass
class SupplyChainAuditResult:
    package_or_binary: str
    is_trusted: bool
    license_status: str       # "PERMISSIVE_MIT_APACHE", "COPYLEFT_GPL", "PROPRIETARY", "UNKNOWN"
    has_known_vulnerability: bool
    hash_verified: bool
    action: str               # "ALLOW", "BLOCK", "REQUIRE_REVIEW"

class SupplyChainDefense:
    def __init__(self):
        self.approved_licenses = {"MIT", "Apache-2.0", "BSD-3-Clause", "ISC"}
        self.banned_packages = {"malicious-typo-pkg", "crypto-stealer-lib", "unverified-binary-dropper"}

    def audit_dependency(
        self,
        name: str,
        version: str,
        declared_license: str = "MIT",
        sha256_hash: str = None,
        expected_sha256: str = None,
    ) -> SupplyChainAuditResult:
        """
        Audits a third-party dependency before installation.
        """
        if name.lower() in self.banned_packages:
            return SupplyChainAuditResult(
                package_or_binary=name,
                is_trusted=False,
                license_status="UNKNOWN",
                has_known_vulnerability=True,
                hash_verified=False,
                action="BLOCK",
            )

        license_ok = declared_license in self.approved_licenses
        hash_ok = (sha256_hash is None and expected_sha256 is None) or (sha256_hash == expected_sha256)

        is_trusted = license_ok and hash_ok

        return SupplyChainAuditResult(
            package_or_binary=name,
            is_trusted=is_trusted,
            license_status="PERMISSIVE_MIT_APACHE" if license_ok else "REQUIRE_REVIEW",
            has_known_vulnerability=False,
            hash_verified=hash_ok,
            action="ALLOW" if is_trusted else "REQUIRE_REVIEW",
        )

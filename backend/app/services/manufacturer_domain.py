"""Manufacturer domain mapping service with learning capability."""

import re
from urllib.parse import urlparse

from app.services.supabase_client import get_supabase_client


def normalize_manufacturer_name(name: str) -> str:
    """
    Normalize manufacturer name for consistent matching.

    Examples:
        "パナソニック" -> "パナソニック"
        "Panasonic " -> "panasonic"
        "SHARP" -> "sharp"
        "日立　製作所" -> "日立製作所"

    Args:
        name: Original manufacturer name

    Returns:
        Normalized manufacturer name
    """
    # Strip whitespace
    normalized = name.strip()
    # Remove full-width spaces
    normalized = normalized.replace("\u3000", "")
    # Lowercase (only affects ASCII)
    normalized = normalized.lower()
    # Remove multiple consecutive spaces
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


def extract_domain_from_url(url: str) -> str | None:
    """
    Extract main domain from URL.

    Examples:
        https://www.panasonic.jp/products/manual.pdf -> panasonic.jp
        https://support.daikin.co.jp/manual/xxx.pdf -> daikin.co.jp
        https://kadenfan.hitachi.co.jp/xxx.pdf -> hitachi.co.jp

    Args:
        url: Full URL

    Returns:
        Domain string or None if extraction fails
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.netloc.lower()

        if not hostname:
            return None

        # Remove www. prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]

        # Split into parts
        parts = hostname.split(".")

        # Handle Japanese domains (.co.jp, .or.jp, .ne.jp, .ac.jp, .go.jp)
        if len(parts) >= 3 and parts[-2] in ("co", "or", "ne", "ac", "go"):
            # e.g., panasonic.co.jp, hitachi.co.jp
            return ".".join(parts[-3:])
        elif len(parts) >= 2:
            # e.g., panasonic.jp, daikin.com
            return ".".join(parts[-2:])

        return hostname
    except Exception:
        return None


class ManufacturerDomainService:
    """Service for managing manufacturer -> domain mappings with learning."""

    async def get_domains(self, manufacturer: str) -> list[str]:
        """
        Get known domains for a manufacturer.

        Domains are sorted by success_count (most successful first).

        Args:
            manufacturer: Manufacturer name

        Returns:
            List of domains (empty if none found or DB unavailable)
        """
        client = get_supabase_client()
        if not client:
            return []

        try:
            normalized = normalize_manufacturer_name(manufacturer)

            result = (
                client.table("manufacturer_domains")
                .select("domain")
                .eq("manufacturer_normalized", normalized)
                .order("success_count", desc=True)
                .limit(5)
                .execute()
            )

            return [row["domain"] for row in result.data]
        except Exception as e:
            print(f"Error getting domains for {manufacturer}: {e}")
            return []

    async def save_domain(self, manufacturer: str, pdf_url: str) -> bool:
        """
        Save/update domain mapping when PDF is successfully found.

        If the manufacturer+domain combination already exists,
        increments success_count. Otherwise, creates new record.

        Args:
            manufacturer: Manufacturer name
            pdf_url: URL of the found PDF

        Returns:
            True if save succeeded, False otherwise
        """
        client = get_supabase_client()
        if not client:
            return False

        domain = extract_domain_from_url(pdf_url)
        if not domain:
            print(f"Could not extract domain from URL: {pdf_url}")
            return False

        try:
            normalized = normalize_manufacturer_name(manufacturer)

            # Try to get existing record
            existing = (
                client.table("manufacturer_domains")
                .select("id, success_count")
                .eq("manufacturer_normalized", normalized)
                .eq("domain", domain)
                .execute()
            )

            if existing.data:
                # Update: increment success_count
                record = existing.data[0]
                client.table("manufacturer_domains").update(
                    {"success_count": record["success_count"] + 1}
                ).eq("id", record["id"]).execute()
                print(
                    f"Updated domain mapping: {manufacturer} -> {domain} "
                    f"(count: {record['success_count'] + 1})"
                )
            else:
                # Insert new record
                client.table("manufacturer_domains").insert(
                    {
                        "manufacturer_normalized": normalized,
                        "manufacturer_original": manufacturer,
                        "domain": domain,
                        "success_count": 1,
                    }
                ).execute()
                print(f"New domain mapping: {manufacturer} -> {domain}")

            return True
        except Exception as e:
            print(f"Error saving domain for {manufacturer}: {e}")
            return False

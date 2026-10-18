"""KAN-16: rank resources for one person's profile. Pure functions, no database, so they're easy to test.

Distance is measured between ZIP-code centers (approximate, good enough for "about 3 miles"). We never use a
person's street address.
"""
import math

from .models import CATEGORIES, SERVES, Resource

# Approximate ZIP centers (lat, lng) for the demo area. Add a ZIP here to support it.
ZIP_CENTERS = {
    # Davidson County / Nashville
    "37013": (36.05, -86.65),  # Antioch
    "37072": (36.33, -86.71),  # Goodlettsville
    "37076": (36.19, -86.60),  # Hermitage
    "37080": (36.33, -86.87),  # Joelton
    "37115": (36.26, -86.70),  # Madison
    "37138": (36.25, -86.62),  # Old Hickory
    "37189": (36.27, -86.83),  # Whites Creek
    "37201": (36.165, -86.78),  # Downtown
    "37203": (36.15, -86.79),
    "37204": (36.11, -86.77),
    "37205": (36.11, -86.87),
    "37206": (36.18, -86.74),  # East Nashville
    "37207": (36.23, -86.77),
    "37208": (36.18, -86.81),
    "37209": (36.15, -86.86),
    "37210": (36.14, -86.74),
    "37211": (36.07, -86.72),
    "37212": (36.13, -86.80),
    "37214": (36.16, -86.67),
    "37215": (36.10, -86.82),
    "37216": (36.21, -86.73),
    "37217": (36.11, -86.66),
    "37218": (36.21, -86.88),
    "37219": (36.17, -86.78),
    "37220": (36.07, -86.78),
    "37221": (36.06, -86.96),
    "37228": (36.19, -86.80),
    # Nearby Middle Tennessee
    "37027": (36.00, -86.79),  # Brentwood
    "37064": (35.93, -86.87),  # Franklin
    "37066": (36.39, -86.45),  # Gallatin
    "37075": (36.30, -86.62),  # Hendersonville
    "37087": (36.21, -86.30),  # Lebanon
    "37122": (36.18, -86.51),  # Mount Juliet
    "37130": (35.85, -86.40),  # Murfreesboro
    # Out-of-area resources in the starter list
    "35801": (34.73, -86.59),  # Huntsville, AL
    "45202": (39.10, -84.51),  # Cincinnati, OH
}

# The area a ZIP is in, for "Nashville / Davidson County" under Welcome on Home (KAN-25). Davidson County ZIPs are
# the ones listed first in ZIP_CENTERS; the nearby ones are named by town.
DAVIDSON_ZIPS = {
    "37013", "37072", "37076", "37080", "37115", "37138", "37189", "37201", "37203", "37204", "37205", "37206",
    "37207", "37208", "37209", "37210", "37211", "37212", "37214", "37215", "37216", "37217", "37218", "37219",
    "37220", "37221", "37228",
}
NEARBY_TOWNS = {
    "37027": "Brentwood", "37064": "Franklin", "37066": "Gallatin", "37075": "Hendersonville", "37087": "Lebanon",
    "37122": "Mount Juliet", "37130": "Murfreesboro",
}


def area_name(zip_code):
    """ "Nashville / Davidson County", a nearby town, or "ZIP 37xxx" for a ZIP we don't know."""
    if zip_code in DAVIDSON_ZIPS:
        return "Nashville / Davidson County"
    return NEARBY_TOWNS.get(zip_code, f"ZIP {zip_code}" if zip_code else "")


# Child age groups from the profile (KAN-6), as [min, max] months.
AGE_GROUPS = {
    "under_3mo": (0, 2),
    "3_12mo": (3, 11),
    "1_2yrs": (12, 35),
    "3_5yrs": (36, 71),
}
PREGNANCY = (-9, -1)

# Profile roles (KAN-6) -> who a resource serves.
ROLE_TO_SERVES = {
    "parent": "parents",
    "guardian": "parents",
    "foster": "foster",
    "kinship": "kinship",
    "adoptive": "adoptive",
}

DEFAULT_RADIUS_MILES = 10
# Short names for reason lines. A category missing here falls back to its full label.
SHORT_CATEGORY = {"essentials": "Diapers", "feeding": "Feeding", "parenting": "Parenting", "housing": "Housing"}


def miles_between(zip_a, zip_b):
    """Miles (unrounded) between two ZIP centers, or None if either ZIP is unknown."""
    a, b = ZIP_CENTERS.get(zip_a), ZIP_CENTERS.get(zip_b)
    if not a or not b:
        return None
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 3959 * 2 * math.asin(math.sqrt(h))


def _age_ranges(profile):
    ranges = [AGE_GROUPS[g] for g in profile.get("ages", []) if g in AGE_GROUPS]
    if profile.get("stage") in ("expecting", "both"):
        ranges.append(PREGNANCY)
    return ranges


def _fits_age(resource, ranges):
    if resource.age_min_months is None and resource.age_max_months is None:
        return True
    if not ranges:
        # No ages given: still show it; the card's limit line explains the age rule.
        return True
    lo = resource.age_min_months if resource.age_min_months is not None else -math.inf
    hi = resource.age_max_months if resource.age_max_months is not None else math.inf
    return any(start <= hi and end >= lo for start, end in ranges)


def _fits_role(resource, profile):
    """Resources only for some groups (e.g. foster/kinship) need a matching role. Others are for everyone."""
    if not resource.serves or "parents" in resource.serves:
        return True
    serves = {ROLE_TO_SERVES[r] for r in profile.get("roles", []) if r in ROLE_TO_SERVES}
    return bool(serves & set(resource.serves))


def _reason(resource, matched_needs, distance):
    parts = [SHORT_CATEGORY.get(c, CATEGORIES[c]) for c in matched_needs]
    if resource.area_type == Resource.LOCAL and distance is not None:
        parts.append("your area")
    elif resource.area_type == Resource.STATEWIDE:
        parts.append("Tennessee")
    reason = "Matches " + _join_words(parts) if parts else "May be a good fit"
    if resource.serves and "parents" not in resource.serves:
        groups = [SERVES[s].split()[0].lower() for s in resource.serves if s in SERVES]
        reason += f" · For {_join_words(groups)} families"
    return reason


def _join_words(words):
    """["foster", "kinship", "adoptive"] -> "foster, kinship and adoptive"."""
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def match_resources(resources, profile, category=None, query="", radius=DEFAULT_RADIUS_MILES):
    """Return [{resource, distance_miles, reason, matches_needs}] ranked needs first, then distance.

    profile: {"zip": "37206", "stage": "expecting|parenting|both", "ages": [AGE_GROUPS keys],
              "roles": [ROLE_TO_SERVES keys or "other"/"prefer_not"], "needs": [CATEGORIES keys]}
    category: a search chip (CATEGORIES key) to filter to, or None for All.
    """
    needs = [n for n in profile.get("needs", []) if n in CATEGORIES]
    ranges = _age_ranges(profile)
    query = (query or "").strip().lower()

    results = []
    for resource in resources:
        if category and category not in resource.categories:
            continue
        if query and query not in f"{resource.title} {resource.summary} {resource.category}".lower():
            continue
        if not _fits_age(resource, ranges) or not _fits_role(resource, profile):
            continue

        distance = None
        if resource.area_type == Resource.LOCAL and resource.zip_code:
            # Compare unrounded miles so the radius is a strict cutoff; round only for display.
            miles = miles_between(profile.get("zip", ""), resource.zip_code)
            if miles is None or miles > radius:
                continue
            distance = round(miles)
        # A local resource with no ZIP yet still shows, without a distance, after the ones we can place.

        matched_needs = [c for c in resource.categories if c in needs]
        results.append(
            {
                "resource": resource,
                "distance_miles": distance,
                "matches_needs": bool(matched_needs),
                "reason": _reason(resource, matched_needs, distance),
            }
        )

    # Needs first, then nearest. Statewide and national have no distance, so they come after local ones.
    results.sort(
        key=lambda r: (
            not r["matches_needs"],
            r["distance_miles"] if r["distance_miles"] is not None else math.inf,
            r["resource"].title,
        )
    )
    return results

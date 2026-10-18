from django.db import models

# The four needs. Same keys on the profile (KAN-6), the search chips (KAN-15) and resource cards.
CATEGORIES = {
    "essentials": "Diapers & everyday essentials",
    "feeding": "Food & feeding support",
    "parenting": "Parenting & newborn support",
    "housing": "Housing & family stability",
}

# Who a resource serves. Matches the organization profile's "Who we serve" (KAN-8), plus adoptive.
SERVES = {
    "parents": "New parents",
    "foster": "Foster families",
    "kinship": "Kinship caregivers",
    "adoptive": "Adoptive families",
}


class Resource(models.Model):
    LOCAL = "local"
    STATEWIDE = "statewide"
    NATIONAL = "national"
    AREA_TYPES = [(LOCAL, "Local"), (STATEWIDE, "Statewide"), (NATIONAL, "National")]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=100)  # display label of the main category
    summary = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Matching tags (KAN-16). Empty list / null means "no limit".
    categories = models.JSONField(default=list, blank=True)  # keys of CATEGORIES
    serves = models.JSONField(default=list, blank=True)  # keys of SERVES; empty = everyone
    age_min_months = models.IntegerField(null=True, blank=True)  # negative = pregnancy
    age_max_months = models.IntegerField(null=True, blank=True)
    area_type = models.CharField(max_length=10, choices=AREA_TYPES, default=LOCAL)
    zip_code = models.CharField(max_length=5, blank=True)  # where distance is measured from (local only)
    limits = models.CharField(max_length=200, blank=True)  # main limit, shown on cards

    # Card facts (KAN-26). Blank means the official page doesn't list it: show "Not listed", never a guess.
    org_type = models.CharField(max_length=50, blank=True)  # Nonprofit, Government program, Company program
    area_served = models.CharField(max_length=200, blank=True)
    who_we_serve = models.CharField(max_length=300, blank=True)
    age_text = models.CharField(max_length=100, blank=True)  # e.g. "Under 2 years"
    referral = models.CharField(max_length=200, blank=True)  # whether a referral or appointment is needed
    next_step = models.CharField(max_length=300, blank=True)
    public_address = models.CharField(max_length=255, blank=True)
    public_phone = models.CharField(max_length=30, blank=True)
    public_email = models.EmailField(blank=True)
    contact_note = models.CharField(max_length=300, blank=True)  # other ways to reach them
    source_url = models.URLField(blank=True)  # the official page the facts came from
    last_checked = models.DateField(null=True, blank=True)
    radius_miles = models.PositiveSmallIntegerField(null=True, blank=True)  # demo approximation, not published

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title

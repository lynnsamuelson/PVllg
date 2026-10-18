"""Accounts use Django's built-in User, with the (lowercased) email stored as the username."""
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from rest_framework import serializers

from resources.matching import AGE_GROUPS, ROLE_TO_SERVES, area_name
from resources.models import CATEGORIES, SERVES

from .models import Profile

User = get_user_model()


def normalize_email(email):
    return email.strip().lower()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")
    joined = serializers.DateTimeField(source="date_joined")
    account_type = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    gives = serializers.SerializerMethodField()
    gets = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "joined", "account_type", "organization", "profile", "gives", "gets"]

    def get_account_type(self, user):
        # Accounts made before account types existed have no Profile; they signed up as people.
        profile = getattr(user, "profile", None)
        return profile.account_type if profile else Profile.PERSON

    def get_profile(self, user):
        """A person's setup answers (KAN-6), in the shape /api/resources/matches/ takes. null until they finish."""
        profile = getattr(user, "profile", None)
        if profile is None or profile.completed_at is None:
            return None
        return {
            "zip": profile.zip_code,
            "area": area_name(profile.zip_code),
            "stage": profile.stage,
            "arrival_month": profile.arrival_month,
            "ages": profile.ages,
            "roles": profile.roles,
            "needs": profile.needs,
            "usage": profile.usage,
        }

    def get_gets(self, user):
        """Get support on (KAN-24): Search and Claims show. Everyone gets support unless they chose Give only."""
        profile = getattr(user, "profile", None)
        return not (profile and profile.usage == "give")

    def get_gives(self, user):
        profile = getattr(user, "profile", None)
        return bool(profile and profile.usage in ("give", "both"))

    def get_organization(self, user):
        org = getattr(user, "organization", None)
        if org is None:
            return None
        return {
            "name": org.name,
            "website": org.website,
            "work_email": org.work_email,
            "status": org.status,
            "about": org.about,
            "serves": org.serves,
            "pickup_address": org.pickup_address,
            "public_contact": org.public_contact,
        }


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    account_type = serializers.ChoiceField(choices=Profile.ACCOUNT_TYPES)

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        # Runs Django's AUTH_PASSWORD_VALIDATORS (length, common passwords, similarity to name/email).
        candidate = User(username=attrs["email"], email=attrs["email"], first_name=attrs["name"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    @transaction.atomic  # a User without its Profile would read as a person
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["name"],
        )
        Profile.objects.create(user=user, account_type=validated_data["account_type"])
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        return normalize_email(value)


# Free email providers can't show that an organization owns its website. Providers with country versions
# (yahoo.co.uk, gmx.de, ...) are matched by their first label.
FREE_EMAIL_DOMAINS = {
    "aol.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net", "bellsouth.net", "fastmail.com",
    "hey.com", "mail.com", "mail.ru", "me.com", "mac.com", "msn.com", "pm.me", "proton.me", "tuta.io", "qq.com",
    "163.com", "126.com", "naver.com", "web.de",
}
FREE_EMAIL_NAMES = {
    "gmail", "googlemail", "yahoo", "ymail", "rocketmail", "hotmail", "outlook", "live", "icloud", "gmx", "yandex",
    "protonmail", "zoho", "zohomail", "tutanota", "aim",
}


def is_free_email_domain(domain):
    return domain in FREE_EMAIL_DOMAINS or domain.split(".", 1)[0] in FREE_EMAIL_NAMES


def website_domain(website):
    """samplecommunitycloset.org from e.g. https://www.SampleCommunityCloset.org/about."""
    host = website.strip().lower().split("://", 1)[-1]
    for sep in "/?#:":
        host = host.split(sep, 1)[0]
    return host[4:] if host.startswith("www.") else host


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    website = serializers.CharField(max_length=255)
    work_email = serializers.EmailField()

    def validate_website(self, value):
        if "." not in website_domain(value):
            raise serializers.ValidationError("Enter your website, like samplecommunitycloset.org.")
        return value.strip()

    def validate(self, attrs):
        domain = website_domain(attrs["website"])
        email = normalize_email(attrs["work_email"])
        email_domain = email.rsplit("@", 1)[-1]
        if is_free_email_domain(email_domain):
            raise serializers.ValidationError({"work_email": ["Free email, like Gmail, can't be used to post items."]})
        if email_domain != domain:
            raise serializers.ValidationError({"work_email": [f"Your email must end with @{domain}."]})
        return {**attrs, "work_email": email, "domain": domain}


PROFILE_ROLES = [*ROLE_TO_SERVES, "other", "prefer_not"]


class PersonProfileSerializer(serializers.Serializer):
    """Profile setup (Mock Ups 3-6). Never takes a street address, birth date, names or medical details."""

    zip = serializers.RegexField(r"^\d{5}$", error_messages={"invalid": "Enter a 5-digit ZIP code."})
    stage = serializers.ChoiceField(choices=Profile.STAGES)
    arrival_month = serializers.RegexField(
        r"^\d{4}-(0[1-9]|1[0-2])$", required=False, allow_blank=True, error_messages={"invalid": "Pick a month."}
    )
    ages = serializers.ListField(child=serializers.ChoiceField(choices=list(AGE_GROUPS)), required=False, max_length=10)
    roles = serializers.ListField(child=serializers.ChoiceField(choices=PROFILE_ROLES), required=False)
    needs = serializers.ListField(
        child=serializers.ChoiceField(choices=list(CATEGORIES)),
        allow_empty=False,
        error_messages={"empty": "Pick at least one."},
    )
    usage = serializers.ChoiceField(choices=Profile.USAGES)

    def validate_roles(self, value):
        roles = list(dict.fromkeys(value))
        if "prefer_not" in roles and len(roles) > 1:
            raise serializers.ValidationError("Prefer not to say can't be picked with other roles.")
        return roles

    def validate_needs(self, value):
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        attrs.setdefault("ages", [])
        attrs.setdefault("roles", [])
        if attrs["stage"] in ("parenting", "both") and not attrs["ages"]:
            raise serializers.ValidationError({"ages": ["Pick an age group for your child."]})
        if attrs["stage"] == "parenting":
            attrs["arrival_month"] = ""
        return attrs


ORG_SERVES = [key for key in SERVES if key != "adoptive"]  # the three "Who we serve" chips on Mock Up 9


def address_zip(address):
    """The ZIP code ending an address ("..., TN 37206" or "37206-1234"), or None."""
    match = re.search(r"(?<![\d-])(\d{5})(?:-\d{4})?\s*$", address, re.ASCII)
    return match.group(1) if match else None


class OrganizationProfileSerializer(serializers.Serializer):
    """Organization profile (Mock Up 9). The address must be the organization's, never a person's home."""

    about = serializers.CharField(max_length=500, required=False, allow_blank=True)
    serves = serializers.ListField(child=serializers.ChoiceField(choices=ORG_SERVES), required=False)
    pickup_address = serializers.CharField(max_length=255)
    public_contact = serializers.CharField(max_length=150)

    def validate_serves(self, value):
        return [s for s in ORG_SERVES if s in value]  # one of each, in chip order

    def validate_pickup_address(self, value):
        # Search measures distance from the ZIP code, so the address needs one.
        if not address_zip(value):
            raise serializers.ValidationError("End the address with its ZIP code, like 123 Example St, Nashville, TN 37206.")
        return value

    def validate_public_contact(self, value):
        if "@" in value:
            try:
                validate_email(value)
            except DjangoValidationError:
                raise serializers.ValidationError("Enter an email or phone number.")
        elif not re.fullmatch(r"\+?[\d\s().-]+", value, re.ASCII) or not 10 <= len(re.sub(r"\D", "", value, flags=re.ASCII)) <= 15:
            raise serializers.ValidationError("Enter an email or phone number.")
        return value

    def validate(self, attrs):
        return {**attrs, "zip_code": address_zip(attrs["pickup_address"])}


class OrganizationCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})

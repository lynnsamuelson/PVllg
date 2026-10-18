"""Accounts use Django's built-in User, with the (lowercased) email stored as the username."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import Profile

User = get_user_model()


def normalize_email(email):
    return email.strip().lower()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")
    joined = serializers.DateTimeField(source="date_joined")
    account_type = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "joined", "account_type", "organization"]

    def get_account_type(self, user):
        # Accounts made before account types existed have no Profile; they signed up as people.
        profile = getattr(user, "profile", None)
        return profile.account_type if profile else Profile.PERSON

    def get_organization(self, user):
        org = getattr(user, "organization", None)
        if org is None:
            return None
        return {"name": org.name, "website": org.website, "work_email": org.work_email, "status": org.status}


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


class OrganizationCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})

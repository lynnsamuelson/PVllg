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

    class Meta:
        model = User
        fields = ["id", "name", "email", "joined", "account_type"]

    def get_account_type(self, user):
        # Accounts made before account types existed have no Profile; they signed up as people.
        profile = getattr(user, "profile", None)
        return profile.account_type if profile else Profile.PERSON


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

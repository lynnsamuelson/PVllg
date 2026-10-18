import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response

from config.log import get_logger

from .models import Organization, Profile
from .serializers import (
    LoginSerializer,
    OrganizationCodeSerializer,
    OrganizationProfileSerializer,
    OrganizationSerializer,
    PersonProfileSerializer,
    SignupSerializer,
    UserSerializer,
)

logger = get_logger(__name__)


def enforce_csrf(request):
    """DRF only checks CSRF for already-logged-in sessions. Signup/login must check it too,
    or another site could silently log a visitor into an attacker's account."""
    SessionAuthentication().enforce_csrf(request)


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """Sets the csrftoken cookie; the frontend sends it back as X-CSRFToken on writes."""
    return Response({"detail": "CSRF cookie set"})


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    user = UserSerializer(request.user).data if request.user.is_authenticated else None
    return Response({"user": user})


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    enforce_csrf(request)
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    logger.info("signup user_id=%s", user.pk)
    return Response({"user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    enforce_csrf(request)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=serializer.validated_data["email"],
        password=serializer.validated_data["password"],
    )
    if user is None:
        logger.warning("login failed email=%s", serializer.validated_data["email"])
        return Response({"detail": "Incorrect email or password."}, status=status.HTTP_400_BAD_REQUEST)
    login(request, user)
    logger.info("login user_id=%s", user.pk)
    return Response({"user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


CODE_TTL = timedelta(minutes=15)  # proposed in KAN-7; the PO still has to confirm it
RESEND_COOLDOWN = timedelta(seconds=30)
MAX_CODE_ATTEMPTS = 5  # tries per code, so 6 digits can't be guessed
MAX_SENDS_PER_DAY = 5  # codes per account per day, so PVill's sender can't be used to flood an inbox


class IsPerson(BasePermission):
    message = "Only personal accounts can do this."

    def has_permission(self, request, view):
        # No Profile means an account from before account types, which signed up as a person.
        profile = getattr(request.user, "profile", None)
        return profile is None or profile.account_type == Profile.PERSON


class IsOrganization(BasePermission):
    message = "Only organization accounts can do this."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        return bool(profile and profile.account_type == Profile.ORGANIZATION)


def hash_code(org, code):
    # A keyed hash is enough: there are only a million codes, and the attempt limit is what stops guessing.
    return hmac.new(settings.SECRET_KEY.encode(), f"{org.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def send_code(org, details=None):
    """Emails a new code that replaces the old one, applying the cooldown and daily cap. Returns an error Response,
    or None once sent. Nothing changes if the email fails, so the old code keeps working."""
    now = timezone.now()
    new_day = not org.send_window_start or now >= org.send_window_start + timedelta(days=1)
    if not new_day and org.send_count >= MAX_SENDS_PER_DAY:
        return Response(
            {"detail": "You've asked for a lot of codes today. Try again tomorrow."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if org.code_sent_at and now < org.code_sent_at + RESEND_COOLDOWN:
        return Response(
            {"detail": "We just sent a code. Wait a few seconds, then try again."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    # Claim this send in one UPDATE that only matches if no other request sent a code since we read the row,
    # so a double-click sends one email. It also retires the old code now: until the new details are saved, the old
    # code must not be able to verify the organization.
    claim = {
        "code_hash": "",
        "code_sent_at": now,
        "send_window_start": now if new_day else org.send_window_start,
        "send_count": 1 if new_day else org.send_count + 1,
    }
    if not Organization.objects.filter(pk=org.pk, code_sent_at=org.code_sent_at, verified_at__isnull=True).update(**claim):
        return Response(
            {"detail": "We just sent a code. Wait a few seconds, then try again."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    code = f"{secrets.randbelow(10**6):06d}"
    try:
        send_mail(
            "Your PVill code",
            f"Your PVill code is {code}. It works for {int(CODE_TTL.total_seconds() // 60)} minutes.\n\n"
            "If you didn't ask for this, you can ignore this email.",
            None,
            [details["work_email"] if details else org.work_email],
        )
    except OSError:  # smtplib errors are OSErrors
        Organization.objects.filter(pk=org.pk, code_sent_at=now).update(
            code_hash=org.code_hash,
            code_sent_at=org.code_sent_at,
            send_window_start=org.send_window_start,
            send_count=org.send_count,
        )
        logger.exception("org code email failed user_id=%s", org.user_id)
        return Response(
            {"detail": "We couldn't send the email. Check the address and try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    Organization.objects.filter(pk=org.pk, code_sent_at=now, verified_at__isnull=True).update(
        **(details or {}), code_hash=hash_code(org, code), code_expires_at=now + CODE_TTL, code_attempts=0
    )
    return None


def already_verified():
    return Response({"detail": "Your organization is already verified."}, status=status.HTTP_400_BAD_REQUEST)


def not_started():
    return Response({"detail": "Tell us about your organization first."}, status=status.HTTP_400_BAD_REQUEST)


def code_expired():
    return Response({"code": ["That code has expired. Send a new code."]}, status=status.HTTP_400_BAD_REQUEST)


def user_response(user):
    user.refresh_from_db()
    return Response({"user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsOrganization])
def organization(request):
    """Saves the organization's details and emails a code to its work email (Mock Up 7)."""
    serializer = OrganizationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    details = serializer.validated_data
    # get_or_create copes with two first submissions at once.
    org, created = Organization.objects.get_or_create(user=request.user, defaults=details)
    if org.verified_at:
        return already_verified()
    error = send_code(org, details)
    if error:
        if created:
            org.delete()  # nothing was sent, so don't keep the half-started organization
        return error
    logger.info("org code sent user_id=%s", request.user.pk)
    return user_response(request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsOrganization])
def organization_resend(request):
    org = Organization.objects.filter(user=request.user).first()
    if org is None:
        return not_started()
    if org.verified_at:
        return already_verified()
    error = send_code(org)
    if error:
        return error
    logger.info("org code resent user_id=%s", request.user.pk)
    return user_response(request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsOrganization])
def organization_verify(request):
    """Checks the emailed code (Mock Up 8). A right, unexpired code marks the organization Verified."""
    serializer = OrganizationCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    org = Organization.objects.filter(user=request.user).first()
    if org is None:
        return not_started()
    if org.verified_at:
        return user_response(request.user)
    # Use up one attempt before checking, in a single UPDATE, so parallel guesses can't get past the limit.
    attempts = Organization.objects.filter(
        pk=org.pk, code_hash=org.code_hash, code_expires_at__gt=timezone.now(), code_attempts__lt=MAX_CODE_ATTEMPTS
    ).exclude(code_hash="")
    if not attempts.update(code_attempts=F("code_attempts") + 1):
        return code_expired()
    if not hmac.compare_digest(hash_code(org, serializer.validated_data["code"]), org.code_hash):
        logger.warning("org code wrong user_id=%s", request.user.pk)
        return Response({"code": ["That code isn't right. Try again."]}, status=status.HTTP_400_BAD_REQUEST)
    # Matches nothing if a new code replaced this one meanwhile; then this code is old.
    if not Organization.objects.filter(pk=org.pk, code_hash=org.code_hash).update(
        verified_at=timezone.now(), code_hash="", code_attempts=0
    ):
        return code_expired()
    logger.info("org verified user_id=%s", request.user.pk)
    return user_response(request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsOrganization])
def organization_profile(request):
    """Saves a Verified organization's public profile (Mock Up 9)."""
    org = Organization.objects.filter(user=request.user, verified_at__isnull=False).first()
    if org is None:
        return Response(
            {"detail": "Confirm your organization's email first."}, status=status.HTTP_403_FORBIDDEN
        )
    serializer = OrganizationProfileSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    profile = serializer.validated_data
    for field, value in profile.items():  # fields left out keep what was saved
        setattr(org, field, value)
    with transaction.atomic():
        org.save(update_fields=list(profile))
        # The organization's items are picked up at its public address, so they follow it (KAN-9).
        request.user.items.exclude(exact_address=profile["pickup_address"]).update(
            exact_address=profile["pickup_address"], zip_code=profile["zip_code"], pickup_changed_at=timezone.now()
        )
    logger.info("org profile saved user_id=%s", request.user.pk)
    return user_response(request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsPerson])
def person_profile(request):
    """Saves a person's profile setup answers (Mock Ups 3-6)."""
    serializer = PersonProfileSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    answers = serializer.validated_data
    with transaction.atomic():
        profile, _ = Profile.objects.get_or_create(user=request.user, defaults={"account_type": Profile.PERSON})
        profile.zip_code = answers["zip"]
        profile.stage = answers["stage"]
        profile.arrival_month = answers.get("arrival_month", "")
        profile.ages = answers["ages"]
        profile.roles = answers["roles"]
        profile.needs = answers["needs"]
        profile.usage = answers["usage"]
        profile.completed_at = timezone.now()
        profile.save()
    logger.info("profile saved user_id=%s", request.user.pk)
    return user_response(request.user)

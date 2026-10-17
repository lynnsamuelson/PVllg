from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from config.log import get_logger

from .serializers import LoginSerializer, SignupSerializer, UserSerializer

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

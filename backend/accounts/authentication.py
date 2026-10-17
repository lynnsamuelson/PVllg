from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Session auth that answers "not logged in" with 401 instead of DRF's default 403.

    DRF only sends 401 when the authenticator provides a WWW-Authenticate header.
    This lets the frontend tell "log in again" (401) apart from "forbidden" (403).
    """

    def authenticate_header(self, request):
        return "Session"

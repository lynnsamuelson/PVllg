from django.db import connection
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from config.log import get_logger

from .models import Note
from .serializers import NoteSerializer

logger = get_logger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness + DB connectivity check, used by the deploy pipeline."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()" if connection.vendor == "mysql" else "SELECT sqlite_version()")
            db_version = cursor.fetchone()[0]
        return Response({"status": "ok", "db": connection.vendor, "db_version": db_version})
    except Exception as exc:
        logger.exception("health check failed")
        return Response({"status": "error", "db": connection.vendor, "error": str(exc)}, status=503)


class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer

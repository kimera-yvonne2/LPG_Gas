from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Operations"],
        summary="Check API liveness",
        responses=inline_serializer(
            name="HealthResponse",
            fields={
                "status": serializers.CharField(),
                "service": serializers.CharField(),
            },
        ),
    )
    def get(self, request):
        return Response({"status": "ok", "service": "lpg-guardian-api"})

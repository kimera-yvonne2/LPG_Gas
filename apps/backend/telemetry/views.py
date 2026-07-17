from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from devices.authentication import DeviceAuthentication

from telemetry.filters import ReadingFilter
from telemetry.models import DepletionEstimate, Reading
from telemetry.permissions import DepletionEstimatePermission, ReadingPermission
from telemetry.selectors import depletion_estimate_list_for, reading_list_for
from telemetry.serializers import (
    DepletionEstimateSerializer,
    DeviceTelemetrySerializer,
    ReadingSerializer,
)
from telemetry.services import ingest_device_telemetry


class DeviceTelemetryView(APIView):
    authentication_classes = (DeviceAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["Device API"],
        summary="Receive authenticated ESP32 telemetry",
        request=DeviceTelemetrySerializer,
        responses={200: ReadingSerializer, 201: ReadingSerializer},
    )
    def post(self, request):
        sensor = request.auth
        serializer = DeviceTelemetrySerializer(
            data=request.data,
            context={"sensor": sensor},
        )
        serializer.is_valid(raise_exception=True)
        try:
            reading, created = ingest_device_telemetry(
                sensor=sensor,
                **serializer.validated_data,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        response = ReadingSerializer(reading).data
        response["duplicate"] = not created
        return Response(
            response,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema_view(
    list=extend_schema(tags=["LPG Assets - Readings"], summary="List sensor readings"),
    retrieve=extend_schema(tags=["LPG Assets - Readings"], summary="Retrieve a sensor reading"),
    create=extend_schema(tags=["LPG Assets - Readings"], summary="Create a sensor reading"),
)
class ReadingViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Reading.objects.none()
    serializer_class = ReadingSerializer
    permission_classes = (ReadingPermission,)
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_class = ReadingFilter
    search_fields = ("sensor__esp32_id",)
    ordering_fields = (
        "timestamp",
        "weight",
        "gas_percentage",
        "mq2_raw",
    )
    ordering = ("-timestamp",)

    def get_queryset(self):
        return reading_list_for(self.request.user, self.request)


@extend_schema_view(
    list=extend_schema(
        tags=["LPG Analytics - Depletion Estimates"],
        summary="List depletion estimates",
    ),
    retrieve=extend_schema(
        tags=["LPG Analytics - Depletion Estimates"],
        summary="Retrieve a depletion estimate",
    ),
)
class DepletionEstimateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = DepletionEstimate.objects.none()
    serializer_class = DepletionEstimateSerializer
    permission_classes = (DepletionEstimatePermission,)
    ordering = ("-generated_at",)

    def get_queryset(self):
        return depletion_estimate_list_for(self.request.user)

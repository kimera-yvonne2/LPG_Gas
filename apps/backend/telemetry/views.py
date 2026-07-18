from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
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

    @action(detail=False, methods=("get",), url_path="history")
    def history(self, request):
        """Return a chart-sized, time-bucketed weight history for one cylinder."""
        try:
            cylinder_id = int(request.query_params["cylinder"])
        except (KeyError, TypeError, ValueError):
            return Response(
                {"detail": "A valid cylinder query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sample_minutes = int(request.query_params.get("sample_minutes", 15))
        except ValueError:
            sample_minutes = 15
        sample_minutes = min(max(sample_minutes, 1), 1440)

        queryset = (
            self.get_queryset()
            .filter(
                cylinder_id=cylinder_id,
                weight__isnull=False,
            )
            .order_by("timestamp")
        )
        latest_reading = queryset.order_by("-timestamp").first()
        if latest_reading is None:
            return Response(
                {"cylinder": cylinder_id, "sample_minutes": sample_minutes, "points": []}
            )

        points = []
        current_bucket = None
        bucket_reading = None
        for reading in queryset.iterator(chunk_size=2000):
            reading_bucket = int(reading.timestamp.timestamp() // (sample_minutes * 60))
            if reading_bucket != current_bucket:
                if bucket_reading is not None:
                    points.append(ReadingSerializer(bucket_reading).data)
                current_bucket = reading_bucket
            bucket_reading = reading
        if bucket_reading is not None:
            points.append(ReadingSerializer(bucket_reading).data)

        return Response(
            {
                "cylinder": cylinder_id,
                "sample_minutes": sample_minutes,
                "latest": ReadingSerializer(latest_reading).data,
                "points": points,
            }
        )


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

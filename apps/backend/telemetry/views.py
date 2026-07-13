from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, mixins, viewsets

from telemetry.filters import ReadingFilter
from telemetry.models import DepletionEstimate, Reading
from telemetry.permissions import DepletionEstimatePermission, ReadingPermission
from telemetry.selectors import depletion_estimate_list_for, reading_list_for
from telemetry.serializers import DepletionEstimateSerializer, ReadingSerializer


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
    search_fields = ("sensor__esp32_id", "cylinder__serial_number")
    ordering_fields = (
        "timestamp",
        "weight",
        "gas_percentage",
        "temperature",
        "signal_strength",
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

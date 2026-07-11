from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, mixins, viewsets

from telemetry.filters import ReadingFilter
from telemetry.models import Reading
from telemetry.permissions import ReadingPermission
from telemetry.selectors import reading_list_for
from telemetry.serializers import ReadingSerializer


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
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_class = ReadingFilter
    search_fields = ("sensor__esp32_id", "sensor__cylinder__serial_number")
    ordering_fields = ("timestamp", "weight", "gas_percentage", "temperature", "signal_strength")
    ordering = ("-timestamp",)

    def get_queryset(self):
        return reading_list_for(self.request.user)

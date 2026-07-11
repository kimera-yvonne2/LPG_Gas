from django.db.models.deletion import ProtectedError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, serializers, viewsets

from devices.filters import CylinderFilter, HouseholdFilter, SensorFilter
from devices.models import Cylinder, Household, Sensor
from devices.permissions import CylinderPermission, HouseholdPermission, SensorPermission
from devices.selectors import cylinder_list_for, household_list_for, sensor_list_for
from devices.serializers import CylinderSerializer, HouseholdSerializer, SensorSerializer


class AssetViewSet(viewsets.ModelViewSet):
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError(
                {"detail": "This asset is referenced by another record and cannot be deleted."}
            ) from exc


@extend_schema_view(
    list=extend_schema(tags=["LPG Assets - Households"], summary="List households"),
    retrieve=extend_schema(tags=["LPG Assets - Households"], summary="Retrieve a household"),
    create=extend_schema(tags=["LPG Assets - Households"], summary="Create a household"),
    update=extend_schema(tags=["LPG Assets - Households"], summary="Replace a household"),
    partial_update=extend_schema(tags=["LPG Assets - Households"], summary="Update a household"),
    destroy=extend_schema(tags=["LPG Assets - Households"], summary="Delete a household"),
)
class HouseholdViewSet(AssetViewSet):
    queryset = Household.objects.none()
    serializer_class = HouseholdSerializer
    permission_classes = (HouseholdPermission,)
    filterset_class = HouseholdFilter
    search_fields = ("name", "email", "phone", "address", "owner__email")
    ordering_fields = ("name", "number_of_people", "created_at")
    ordering = ("name",)

    def get_queryset(self):
        return household_list_for(self.request.user)


@extend_schema_view(
    list=extend_schema(tags=["LPG Assets - Cylinders"], summary="List cylinders"),
    retrieve=extend_schema(tags=["LPG Assets - Cylinders"], summary="Retrieve a cylinder"),
    create=extend_schema(tags=["LPG Assets - Cylinders"], summary="Create a cylinder"),
    update=extend_schema(tags=["LPG Assets - Cylinders"], summary="Replace a cylinder"),
    partial_update=extend_schema(tags=["LPG Assets - Cylinders"], summary="Update a cylinder"),
    destroy=extend_schema(tags=["LPG Assets - Cylinders"], summary="Delete a cylinder"),
)
class CylinderViewSet(AssetViewSet):
    queryset = Cylinder.objects.none()
    serializer_class = CylinderSerializer
    permission_classes = (CylinderPermission,)
    filterset_class = CylinderFilter
    search_fields = ("serial_number", "household__name", "household__email")
    ordering_fields = ("serial_number", "capacity", "gas_percentage", "installation_date")
    ordering = ("serial_number",)

    def get_queryset(self):
        return cylinder_list_for(self.request.user)


@extend_schema_view(
    list=extend_schema(tags=["LPG Assets - Sensors"], summary="List sensors"),
    retrieve=extend_schema(tags=["LPG Assets - Sensors"], summary="Retrieve a sensor"),
    create=extend_schema(tags=["LPG Assets - Sensors"], summary="Register a sensor"),
    update=extend_schema(tags=["LPG Assets - Sensors"], summary="Replace a sensor"),
    partial_update=extend_schema(tags=["LPG Assets - Sensors"], summary="Update a sensor"),
    destroy=extend_schema(tags=["LPG Assets - Sensors"], summary="Delete a sensor"),
)
class SensorViewSet(AssetViewSet):
    queryset = Sensor.objects.none()
    serializer_class = SensorSerializer
    permission_classes = (SensorPermission,)
    filterset_class = SensorFilter
    search_fields = ("esp32_id", "mac_address", "firmware_version", "cylinder__serial_number")
    ordering_fields = ("esp32_id", "battery_level", "last_seen", "created_at")
    ordering = ("esp32_id",)

    def get_queryset(self):
        return sensor_list_for(self.request.user)

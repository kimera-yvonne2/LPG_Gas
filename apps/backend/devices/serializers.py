from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from devices.services import create_cylinder, create_household, create_sensor, update_cylinder


def validate_model(instance):
    try:
        instance.full_clean()
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.message_dict) from exc


class HouseholdSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Household
        fields = (
            "id",
            "owner",
            "owner_email",
            "name",
            "email",
            "phone",
            "address",
            "number_of_people",
            "usage_type",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"owner": {"required": False}}

    def validate_owner(self, owner):
        if owner.role != User.Role.HOUSEHOLD:
            raise serializers.ValidationError("Household owner must have the household role.")
        return owner

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role == User.Role.HOUSEHOLD:
            attrs["owner"] = request.user
        elif not self.instance and "owner" not in attrs:
            raise serializers.ValidationError({"owner": "This field is required."})
        values = {
            field: attrs.get(field, getattr(self.instance, field, None))
            for field in (
                "owner",
                "name",
                "email",
                "phone",
                "address",
                "number_of_people",
                "usage_type",
            )
        }
        candidate = Household(**values)
        if self.instance:
            candidate.pk = self.instance.pk
        validate_model(candidate)
        return attrs

    def create(self, validated_data):
        return create_household(**validated_data)


class CylinderSerializer(serializers.ModelSerializer):
    household_name = serializers.CharField(source="household.name", read_only=True)

    class Meta:
        model = Cylinder
        fields = (
            "id",
            "household",
            "household_name",
            "serial_number",
            "capacity",
            "empty_weight",
            "current_weight",
            "gas_percentage",
            "installation_date",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "gas_percentage", "created_at", "updated_at")

    def validate_household(self, household):
        user = self.context["request"].user
        if user.role == User.Role.HOUSEHOLD and household.owner_id != user.id:
            raise serializers.ValidationError("You can only manage cylinders in your household.")
        return household

    def validate(self, attrs):
        values = {
            "household": attrs.get("household", getattr(self.instance, "household", None)),
            "serial_number": attrs.get(
                "serial_number", getattr(self.instance, "serial_number", None)
            ),
            "capacity": attrs.get("capacity", getattr(self.instance, "capacity", None)),
            "empty_weight": attrs.get("empty_weight", getattr(self.instance, "empty_weight", None)),
            "current_weight": attrs.get(
                "current_weight", getattr(self.instance, "current_weight", None)
            ),
            "installation_date": attrs.get(
                "installation_date", getattr(self.instance, "installation_date", None)
            ),
            "status": attrs.get("status", getattr(self.instance, "status", Cylinder.Status.ACTIVE)),
        }
        candidate = Cylinder(**values)
        if self.instance:
            candidate.pk = self.instance.pk
        try:
            candidate.full_clean(exclude=("gas_percentage",))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def create(self, validated_data):
        return create_cylinder(**validated_data)

    def update(self, instance, validated_data):
        return update_cylinder(instance=instance, **validated_data)


class SensorSerializer(serializers.ModelSerializer):
    cylinder_serial_number = serializers.CharField(source="cylinder.serial_number", read_only=True)

    class Meta:
        model = Sensor
        fields = (
            "id",
            "cylinder",
            "cylinder_serial_number",
            "esp32_id",
            "firmware_version",
            "mac_address",
            "battery_level",
            "online_status",
            "last_seen",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance is None:
            candidate = Sensor(**attrs)
            try:
                candidate.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict) from exc
            return attrs

        values = {
            field: attrs.get(field, getattr(self.instance, field, None))
            for field in (
                "cylinder",
                "esp32_id",
                "firmware_version",
                "mac_address",
                "battery_level",
                "online_status",
                "last_seen",
            )
        }
        return attrs

    def create(self, validated_data):
        return create_sensor(**validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        Sensor.objects.filter(pk=instance.pk).update(**validated_data)
        instance.refresh_from_db()
        return instance

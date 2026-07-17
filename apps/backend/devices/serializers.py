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
    owner_name = serializers.CharField(source="owner.username", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Household
        fields = (
            "id",
            "owner",
            "owner_name",
            "owner_email",
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
        candidate = Household(owner=attrs.get("owner", getattr(self.instance, "owner", None)))
        if self.instance:
            candidate.pk = self.instance.pk
        validate_model(candidate)
        return attrs

    def create(self, validated_data):
        return create_household(**validated_data)


class CylinderSerializer(serializers.ModelSerializer):
    household_name = serializers.CharField(source="household.owner.username", read_only=True)
    latest_weight = serializers.SerializerMethodField()
    latest_gas_percentage = serializers.SerializerMethodField()
    latest_reading_at = serializers.SerializerMethodField()
    full_weight = serializers.SerializerMethodField()

    class Meta:
        model = Cylinder
        fields = (
            "id",
            "household",
            "household_name",
            "capacity",
            "full_weight",
            "empty_weight",
            "latest_weight",
            "latest_gas_percentage",
            "latest_reading_at",
            "installation_date",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "full_weight",
            "latest_weight",
            "latest_gas_percentage",
            "latest_reading_at",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {"household": {"required": False}}

    def _latest_values(self, obj):
        if hasattr(obj, "latest_weight"):
            return obj.latest_weight, obj.latest_gas_percentage, obj.latest_reading_at
        reading = obj.readings.only("weight", "gas_percentage", "timestamp").first()
        if reading is None:
            return None, None, None
        return reading.weight, reading.gas_percentage, reading.timestamp

    def get_latest_weight(self, obj):
        weight, _, _ = self._latest_values(obj)
        return format(weight, ".3f") if weight is not None else None

    def get_latest_gas_percentage(self, obj):
        _, percentage, _ = self._latest_values(obj)
        return format(percentage, ".2f") if percentage is not None else None

    def get_latest_reading_at(self, obj):
        _, _, timestamp = self._latest_values(obj)
        return (
            serializers.DateTimeField().to_representation(timestamp)
            if timestamp is not None
            else None
        )

    def get_full_weight(self, obj):
        return format(obj.empty_weight + obj.capacity, ".3f")

    def validate_household(self, household):
        user = self.context["request"].user
        if user.role == User.Role.HOUSEHOLD:
            try:
                return user.household
            except Household.DoesNotExist:
                raise serializers.ValidationError(
                    "Your household account has not been provisioned."
                ) from None
        return household

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role == User.Role.HOUSEHOLD:
            try:
                attrs["household"] = request.user.household
            except Household.DoesNotExist:
                raise serializers.ValidationError(
                    {"household": "Your household account has not been provisioned."}
                ) from None
        elif not self.instance and "household" not in attrs:
            raise serializers.ValidationError({"household": "This field is required."})

        values = {
            "household": attrs.get("household", getattr(self.instance, "household", None)),
            "capacity": attrs.get("capacity", getattr(self.instance, "capacity", None)),
            "empty_weight": attrs.get("empty_weight", getattr(self.instance, "empty_weight", None)),
            "installation_date": attrs.get(
                "installation_date", getattr(self.instance, "installation_date", None)
            ),
            "status": attrs.get("status", getattr(self.instance, "status", Cylinder.Status.ACTIVE)),
        }
        candidate = Cylinder(**values)
        if self.instance:
            candidate.pk = self.instance.pk
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def create(self, validated_data):
        return create_cylinder(**validated_data)

    def update(self, instance, validated_data):
        return update_cylinder(instance=instance, **validated_data)


class SensorSerializer(serializers.ModelSerializer):
    pairing_status = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = (
            "id",
            "household",
            "cylinder",
            "esp32_id",
            "mac_address",
            "battery_level",
            "online_status",
            "is_active",
            "last_seen",
            "claimed_at",
            "pairing_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "is_active",
            "claimed_at",
            "pairing_status",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "household": {"required": False, "allow_null": True},
            "cylinder": {"required": False, "allow_null": True},
        }

    def get_pairing_status(self, obj):
        if obj.household_id is None:
            return "unpaired"
        if obj.cylinder_id is None:
            return "claimed"
        return "connected"

    def validate_household(self, household):
        user = self.context["request"].user
        if user.role == User.Role.HOUSEHOLD:
            try:
                return user.household
            except Household.DoesNotExist:
                raise serializers.ValidationError(
                    "Your household account has not been provisioned."
                ) from None
        return household

    def validate_cylinder(self, cylinder):
        if cylinder is None:
            return None
        user = self.context["request"].user
        if user.role == User.Role.HOUSEHOLD and cylinder.household.owner_id != user.id:
            raise serializers.ValidationError(
                "You can only connect sensors to cylinders in your household."
            )
        return cylinder

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role == User.Role.HOUSEHOLD:
            try:
                attrs["household"] = request.user.household
            except Household.DoesNotExist:
                raise serializers.ValidationError(
                    {"household": "Your household account has not been provisioned."}
                ) from None
        elif not self.instance and "household" not in attrs:
            cylinder = attrs.get("cylinder")
            if cylinder:
                attrs["household"] = cylinder.household
            else:
                raise serializers.ValidationError({"household": "This field is required."})
        household = attrs.get("household", getattr(self.instance, "household", None))
        cylinder = attrs.get("cylinder", getattr(self.instance, "cylinder", None))
        if cylinder and household and cylinder.household_id != household.id:
            raise serializers.ValidationError(
                {"cylinder": "The device and cylinder must belong to the same household."}
            )
        if cylinder and cylinder.status == Cylinder.Status.RETIRED:
            raise serializers.ValidationError(
                {"cylinder": "A retired cylinder cannot receive a device."}
            )
        if self.instance is None:
            candidate = Sensor(**attrs)
            validate_model(candidate)

        return attrs

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        validate_model(instance)
        instance.save()
        return instance

    def create(self, validated_data):
        return create_sensor(**validated_data)


class SensorConnectionSerializer(serializers.Serializer):
    cylinder = serializers.PrimaryKeyRelatedField(queryset=Cylinder.objects.all())


class DeviceClaimSerializer(serializers.Serializer):
    pairing_code = serializers.RegexField(r"^\d{6}$")
    household = serializers.PrimaryKeyRelatedField(queryset=Household.objects.all(), required=False)


class CylinderReplacementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cylinder
        fields = (
            "capacity",
            "empty_weight",
            "installation_date",
        )

    def validate(self, attrs):
        candidate = Cylinder(
            household=self.context["cylinder"].household,
            status=Cylinder.Status.ACTIVE,
            **attrs,
        )
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

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

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and getattr(request.user, "role", None) == User.Role.TECHNICIAN:
            fields.pop("owner_email", None)
        return fields

    def validate_owner(self, owner):
        if owner.role != User.Role.HOUSEHOLD:
            raise serializers.ValidationError(
                "Household owner must have the household role."
            )
        return owner

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role == User.Role.HOUSEHOLD:
            attrs["owner"] = request.user
        elif not self.instance and "owner" not in attrs:
            raise serializers.ValidationError({"owner": "This field is required."})
        candidate = Household(
            owner=attrs.get("owner", getattr(self.instance, "owner", None))
        )
        if self.instance:
            candidate.pk = self.instance.pk
        validate_model(candidate)
        return attrs

    def create(self, validated_data):
        return create_household(**validated_data)


class CylinderSerializer(serializers.ModelSerializer):
    household_name = serializers.CharField(
        source="household.owner.username", read_only=True
    )

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
        extra_kwargs = {"household": {"required": False}}

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
            "household": attrs.get(
                "household", getattr(self.instance, "household", None)
            ),
            "serial_number": attrs.get(
                "serial_number", getattr(self.instance, "serial_number", None)
            ),
            "capacity": attrs.get("capacity", getattr(self.instance, "capacity", None)),
            "empty_weight": attrs.get(
                "empty_weight", getattr(self.instance, "empty_weight", None)
            ),
            "current_weight": attrs.get(
                "current_weight", getattr(self.instance, "current_weight", None)
            ),
            "installation_date": attrs.get(
                "installation_date", getattr(self.instance, "installation_date", None)
            ),
            "status": attrs.get(
                "status", getattr(self.instance, "status", Cylinder.Status.ACTIVE)
            ),
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
    cylinder_serial_number = serializers.CharField(
        source="cylinder.serial_number", read_only=True, allow_null=True
    )

    class Meta:
        model = Sensor
        fields = (
            "id",
            "household",
            "cylinder",
            "cylinder_serial_number",
            "esp32_id",
            "firmware_version",
            "mac_address",
            "battery_level",
            "online_status",
            "is_active",
            "last_seen",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_active", "created_at", "updated_at")
        extra_kwargs = {
            "household": {"required": False},
            "cylinder": {"required": False, "allow_null": True},
        }

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
                raise serializers.ValidationError(
                    {"household": "This field is required."}
                )
        household = attrs.get("household", getattr(self.instance, "household", None))
        cylinder = attrs.get("cylinder", getattr(self.instance, "cylinder", None))
        if cylinder and household and cylinder.household_id != household.id:
            raise serializers.ValidationError(
                {
                    "cylinder": "The device and cylinder must belong to the same household."
                }
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


class CylinderReplacementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cylinder
        fields = (
            "serial_number",
            "capacity",
            "empty_weight",
            "current_weight",
            "installation_date",
        )

    def validate(self, attrs):
        candidate = Cylinder(
            household=self.context["cylinder"].household,
            status=Cylinder.Status.ACTIVE,
            **attrs,
        )
        try:
            candidate.full_clean(exclude=("gas_percentage",))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

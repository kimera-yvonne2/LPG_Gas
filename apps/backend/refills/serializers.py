from accounts.models import User
from refills.models import RefillRequest
from rest_framework import serializers


class RefillProviderSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="username")

    class Meta:
        model = User
        fields = ("id", "name")
        read_only_fields = fields


class RefillTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RefillRequest.Status.choices)


class RefillRequestSerializer(serializers.ModelSerializer):
    customer = serializers.SerializerMethodField()

    class Meta:
        model = RefillRequest
        fields = (
            "id",
            "household",
            "cylinder",
            "assigned_technician",
            "customer",
            "status",
            "source",
            "requested_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "requested_at", "updated_at")

    def get_customer(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        user = request.user
        if user.role == User.Role.ADMIN or (
            user.role == User.Role.TECHNICIAN and obj.assigned_technician_id == user.id
        ):
            owner = obj.household.owner
            return {
                "name": owner.username,
                "email": owner.email,
                "phone": owner.phone_number,
            }
        return None

    def validate_assigned_technician(self, technician):
        if technician.role != User.Role.TECHNICIAN or not technician.is_active:
            raise serializers.ValidationError(
                "The refill provider must be an active technician."
            )
        return technician

    def validate_household(self, household):
        request = self.context["request"]
        if request.user.role == "household" and household.owner_id != request.user.id:
            raise serializers.ValidationError(
                "You can only create refill requests for your own household."
            )
        return household

    def validate_cylinder(self, cylinder):
        request = self.context["request"]
        if (
            request.user.role == "household"
            and cylinder.household.owner_id != request.user.id
        ):
            raise serializers.ValidationError(
                "You can only request refills for your own cylinders."
            )
        if cylinder.status == cylinder.Status.RETIRED:
            raise serializers.ValidationError("A retired cylinder cannot be refilled.")
        return cylinder

    def validate(self, attrs):
        request = self.context["request"]
        source = attrs.get(
            "source",
            getattr(self.instance, "source", RefillRequest.Source.MANUAL),
        )
        technician = attrs.get(
            "assigned_technician",
            getattr(self.instance, "assigned_technician", None),
        )
        household = attrs.get("household", getattr(self.instance, "household", None))
        cylinder = attrs.get("cylinder", getattr(self.instance, "cylinder", None))

        if (
            request.user.role == User.Role.HOUSEHOLD
            and source == RefillRequest.Source.MANUAL
            and technician is None
        ):
            raise serializers.ValidationError(
                {"assigned_technician": "Select a refill provider for this request."}
            )
        if household and cylinder and cylinder.household_id != household.id:
            raise serializers.ValidationError(
                {"cylinder": "The cylinder must belong to the selected household."}
            )
        return attrs

    def create(self, validated_data):
        return RefillRequest.objects.create(**validated_data)

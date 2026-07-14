from rest_framework import serializers

from accounts.models import User
from refills.models import RefillRequest


class RefillProviderSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="username")

    class Meta:
        model = User
        fields = ("id", "name", "email", "phone_number")
        read_only_fields = fields


class RefillTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RefillRequest.Status.choices)


class RefillRequestSerializer(serializers.ModelSerializer):
    customer = serializers.SerializerMethodField()
    provider = RefillProviderSerializer(source="assigned_technician", read_only=True)

    class Meta:
        model = RefillRequest
        fields = (
            "id",
            "household",
            "assigned_technician",
            "provider",
            "customer",
            "status",
            "source",
            "requested_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "requested_at", "updated_at")
        extra_kwargs = {"household": {"required": False}}

    def get_customer(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        user = request.user
        role = getattr(user, "role", None)
        if role == User.Role.ADMIN or (
            role == User.Role.TECHNICIAN
            and obj.assigned_technician_id == getattr(user, "id", None)
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

    def validate(self, attrs):
        request = self.context["request"]
        technician = attrs.get(
            "assigned_technician",
            getattr(self.instance, "assigned_technician", None),
        )
        if request.user.role == User.Role.HOUSEHOLD and technician is None:
            raise serializers.ValidationError(
                {"assigned_technician": "Select a refill provider for this request."}
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if request.user.role == User.Role.HOUSEHOLD:
            validated_data["household"] = request.user.household
            validated_data["source"] = RefillRequest.Source.MANUAL
        elif "household" not in validated_data:
            raise serializers.ValidationError({"household": "This field is required."})
        return RefillRequest.objects.create(**validated_data)

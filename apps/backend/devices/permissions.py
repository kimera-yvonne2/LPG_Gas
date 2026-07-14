from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User


def is_valid_user(user):
    return bool(user and user.is_authenticated and user.is_active)


class HouseholdPermission(BasePermission):
    def has_permission(self, request, view):
        if not is_valid_user(request.user):
            return False

        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return False
        if request.user.role == User.Role.HOUSEHOLD:
            return request.method in SAFE_METHODS or not hasattr(
                request.user, "household"
            )
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return False
        if request.user.role == User.Role.HOUSEHOLD:
            return obj.owner_id == request.user.id
        return False


class CylinderPermission(BasePermission):
    def has_permission(self, request, view):
        if not is_valid_user(request.user):
            return False
        if request.user.role == User.Role.TECHNICIAN:
            return False
        return request.user.role in {
            User.Role.ADMIN,
            User.Role.HOUSEHOLD,
        }

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return False
        if request.user.role == User.Role.HOUSEHOLD:
            return obj.household.owner_id == request.user.id
        return False


class SensorPermission(BasePermission):
    def has_permission(self, request, view):
        if not is_valid_user(request.user):
            return False
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.HOUSEHOLD:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return False
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.HOUSEHOLD:
            return obj.household.owner_id == request.user.id
        if request.user.role == User.Role.TECHNICIAN:
            return False
        return False

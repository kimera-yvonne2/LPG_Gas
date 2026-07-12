from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User


class HouseholdPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.is_active:
            return False
        if request.user.role in {User.Role.ADMIN, User.Role.TECHNICIAN}:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS
        if request.user.role == User.Role.HOUSEHOLD:
            return view.action != "create" or not hasattr(request.user, "household")
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role in {User.Role.ADMIN, User.Role.TECHNICIAN}:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS
        return obj.owner_id == request.user.id


class CylinderPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.is_active:
            return False
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS
        return request.user.role in {
            User.Role.ADMIN,
            User.Role.HOUSEHOLD,
            User.Role.TECHNICIAN,
        }

    def has_object_permission(self, request, view, obj):
        if request.user.role in {User.Role.ADMIN, User.Role.TECHNICIAN}:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS
        return obj.household.owner_id == request.user.id


class SensorPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.is_active:
            return False
        if request.user.role == User.Role.HOUSEHOLD:
            return request.method in SAFE_METHODS
        return request.user.role in {
            User.Role.ADMIN,
            User.Role.TECHNICIAN,
            User.Role.TECHNICIAN,
        }

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.HOUSEHOLD:
            return (
                request.method in SAFE_METHODS
                and obj.cylinder.household.owner_id == request.user.id
            )
        return request.user.role in {
            User.Role.ADMIN,
            User.Role.TECHNICIAN,
            User.Role.TECHNICIAN,
        }

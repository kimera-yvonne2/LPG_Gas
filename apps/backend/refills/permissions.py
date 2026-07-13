from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User


class RefillRequestPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.role == User.Role.ADMIN:
            return True
        if getattr(view, "action", None) == "transition":
            return user.role in {User.Role.HOUSEHOLD, User.Role.TECHNICIAN}
        if user.role == User.Role.HOUSEHOLD:
            return request.method in SAFE_METHODS or request.method == "POST"
        if user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == User.Role.ADMIN:
            return True
        if getattr(view, "action", None) == "transition":
            if user.role == User.Role.HOUSEHOLD:
                return obj.household.owner_id == user.id
            if user.role == User.Role.TECHNICIAN:
                return obj.assigned_technician_id == user.id
            return False
        if user.role == User.Role.HOUSEHOLD:
            return request.method in SAFE_METHODS and obj.household.owner_id == user.id
        if user.role == User.Role.TECHNICIAN:
            return (
                request.method in SAFE_METHODS and obj.assigned_technician_id == user.id
            )
        return False

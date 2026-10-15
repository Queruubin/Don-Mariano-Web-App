def user_can_authenticate(user) -> bool:
    """FR-4: inactive users, and users of an inactive branch, cannot log in or operate."""
    if user is None or not user.is_active:
        return False
    if user.is_super_admin:
        return True
    return user.branch is not None and user.branch.is_active

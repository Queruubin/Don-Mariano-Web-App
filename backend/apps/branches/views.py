from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.branches.models import Branch
from apps.branches.serializers import BranchSerializer
from apps.common.permissions import IsSuperAdmin


class BranchViewSet(viewsets.ModelViewSet):
    """Super admin only. DELETE deactivates the branch (FR-5)."""

    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsSuperAdmin]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        branch = self.get_object()
        branch.is_active = True
        branch.save(update_fields=["is_active"])
        return Response(self.get_serializer(branch).data)

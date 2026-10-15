import pytest

from apps.common.scoping import BRANCH_HEADER


@pytest.mark.django_db
def test_cors_preflight_allows_branch_header(client, settings):
    # The super admin's branch selector sends X-Branch-Id from the frontend origin.
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    response = client.options(
        "/api/products/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS=f"authorization,{BRANCH_HEADER.lower()}",
    )
    assert response.status_code == 200
    allowed = response["Access-Control-Allow-Headers"].lower()
    assert BRANCH_HEADER.lower() in allowed

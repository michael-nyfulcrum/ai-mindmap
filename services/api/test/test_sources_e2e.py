from __future__ import annotations

from unittest.mock import patch

from test.helpers import ApiE2ECase


class SourceEndpointE2ETest(ApiE2ECase):
    def test_fetch_normalizes_figma_link_into_source_snapshot(self) -> None:
        response = self.client.post(
            "/api/sources/fetch",
            json={"url": "https://www.figma.com/design/abc123/Help-Center?node-id=1-2"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["source"]["kind"], "figma")
        self.assertEqual(body["source"]["source_id"], "Help-Center")

        snapshot_node = body["snapshotNode"]
        self.assertEqual(snapshot_node["data"]["canvasType"], "source_snapshot")
        self.assertEqual(snapshot_node["data"]["title"], "Figma reference")
        self.assertEqual(snapshot_node["data"]["tags"], ["source", "figma"])
        self.assertIn("https://www.figma.com/design/abc123/Help-Center", snapshot_node["data"]["fields"]["content"])

    def test_search_sources_returns_unconfigured_atlassian_response_without_credentials(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "ATLASSIAN_URL": "",
                "ATLASSIAN_EMAIL": "",
                "ATLASSIAN_TOKEN": "",
            },
        ):
            response = self.client.post(
                "/api/sources/search",
                json={"query": "HELP-1001", "sources": ["jira", "confluence"], "maxResults": 2},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "no_matches")
        self.assertEqual(body["query"], "HELP-1001")
        self.assertEqual(body["sources_requested"], ["jira", "confluence"])
        self.assertEqual(body["sources"], [])
        self.assertIn("Atlassian access is not configured", body["message"])

    def test_search_sources_tolerates_invalid_max_results(self) -> None:
        response = self.client.post(
            "/api/sources/search",
            json={"query": "HELP-1001", "sources": ["unknown"], "maxResults": "not-a-number"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "no_matches")
        self.assertEqual(body["query"], "HELP-1001")
        self.assertEqual(body["sources_requested"], [])
        self.assertEqual(body["sources"], [])

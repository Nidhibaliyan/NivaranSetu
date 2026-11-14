# Legal document ingestion

## Source policy

Only ingest the actual text of current, verified official material:
- India Code / Gazette of India legislation and rules.
- RBI circulars, Master Directions, notifications and official scheme documents.
- Other government or regulator sources relevant to the grievance categories.

Do not ingest unofficial blogs, law-firm explainers, social posts, or AI-generated summaries as primary law. Keep official title, issuing authority, source URL, language, effective date and section reference accurate.

## Endpoint

`POST /api/legal-rag/ingest`

Headers:
```http
Content-Type: application/json
x-legal-rag-token: <server-only ingestion token>
```

Body:
```json
{
  "title": "RBI Circular on Customer Protection — illustrative title",
  "sourceUrl": "https://www.rbi.org.in/",
  "authority": "Reserve Bank of India",
  "actTitle": "RBI customer protection directions",
  "sectionRef": "Relevant paragraph",
  "language": "en",
  "effectiveDate": "2017-07-06",
  "sourceVerified": true,
  "text": "Paste the verified official document text here..."
}
```

The endpoint stores metadata, chunks the supplied text, creates 3072-dimensional multilingual embeddings and inserts the chunks. The `sourceVerified` flag must be true only after a human verifies the text against the official source. Keep the ingestion endpoint private; do not build a public browser form around it.

## Updating or withdrawing a source

For amended/repealed material, do not silently overwrite legal history. Insert a new document version with the correct effective date, then deactivate the old version using a controlled server-side administrative operation. This initial package intentionally does not expose a public delete/update endpoint.

## Operational limits

The initial implementation embeds chunks sequentially to avoid bursts and partial ingestion complexity. Large acts should be ingested in batches with retry/resume support before production scale. Add an ingestion job ledger and duplicate detection before bulk-loading thousands of pages.

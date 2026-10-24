# Validation results

Validated on **24 October 2026**, using Node.js **v24.21.0** and Postman CLI **1.73.0**.

| Check | Result |
| --- | --- |
| Clean dependency installation from committed package files | `npm ci --no-audit --no-fund` succeeded; 65 packages installed |
| Automated API tests | `npm test`: 15 passed, 0 failed |
| Postman collection requests | 70 executed, 0 failed |
| Postman assertions | 141 executed, 0 failed |
| Postman test scripts | 70 executed, 0 failed |
| Postman CLI process | Exit code 0 |
| Trips logging | Server terminal showed GET, POST, PUT and DELETE method/URL lines, including both route aliases |

The clean installation was performed in a separate temporary directory using copies of the repository's `package.json` and `package-lock.json`. The Postman run used a fresh development server on port 3152 to avoid interfering with other local work.

## Reproduce the Postman run

Start the API:

```bash
PORT=3152 npm start
```

In another terminal, run:

```bash
postman collection run postman/Lab5.postman_collection.json \
  -e postman/Local.postman_environment.json \
  --env-var baseUrl=http://127.0.0.1:3152 \
  --no-report-events
```

On the development machine, `postman` was invoked using its installed path `/Users/ahmedhazem/.local/bin/postman`.

## Coverage

- Users: create, list, retrieve, update both fields, delete, verify changes with GET, input validation, malformed and unknown IDs, ignored extra properties, trimming, and a new unique ID after deletion.
- Trips: public GETs; missing, user and incorrectly cased admin roles; authorization before validation; admin-only creation, update and deletion; invalid strings and missing, string, zero, negative, null and nonfinite costs.
- Comparison: public access, both route aliases, correct absolute cost difference, cheaper destination, equal costs, invalid IDs, duplicate IDs and unknown trips.
- Mutation safety: snapshots confirm that rejected trip mutations and comparisons leave records unchanged. Temporary test records are cleaned up and original records are preserved.

All storage is in memory. These checks verify the two lab APIs and middleware; they do not claim database persistence or production authentication.

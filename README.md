# Lab 5.1 and Lab 5.2: Users and Trips API

A single Express project completing **Users API Practice (Lab 5.1)** and **Travel Agency Trips API (Lab 5.2)** with MVC architecture. Both APIs use in-memory arrays and `for` loops to find records. No database is required for these labs.

## Run locally

Install Node.js **20 or newer**, then run these commands from the project directory:

```bash
npm ci
npm start
```

The default server URL is `http://localhost:3000`. To use another port, set `PORT`, for example `PORT=3001 npm start`.

Run the automated checks in a separate terminal:

```bash
npm test
```

Data is stored in memory: restarting the server clears users and restores the initial trips. Users begin empty. The initial trips are Paris, France (400), Tokyo, Japan (800), and Cairo, Egypt (150), with IDs 1, 2 and 3. Prices are numeric values; these labs do not specify a currency.

## MVC structure

```text
index.js                         Creates and configures the Express app
server.js                        Starts the HTTP server
models/userModel.js              Users array, IDs and search/update/delete logic
models/Trip.js                   Trips array, IDs and search/update/delete logic
controllers/userController.js    Users request handling and HTTP responses
controllers/tripController.js    Trips request handling and comparison
routes/userRouter.js             Users routes
routes/tripRoutes.js             Trips routes
middleware/verifyAdmin.js        Classroom admin role check
middleware/validateTrip.js       Trip input validation
middleware/logRequest.js         Trip method and URL logging
test/                            Automated API tests
postman/                         Runnable collection and local environment
reference/                       Original VS Code and pasted starter code
```

The models own the data, controllers produce JSON responses, and routers connect endpoints to controllers and middleware. JSON responses serve as the API's presentation layer; HTML views are unnecessary for this project.

## Lab 5.1: Users

Base route: `/api/v1/users`. User objects contain **only** `id`, `name` and `email`.

| Method | Endpoint | Successful result |
| --- | --- | --- |
| POST | `/api/v1/users` | `201`, newly created user |
| GET | `/api/v1/users` | `200`, array of users |
| GET | `/api/v1/users/:id` | `200`, matching user |
| PUT | `/api/v1/users/:id` | `200`, updated user |
| DELETE | `/api/v1/users/:id` | `200`, confirmation message |

Both POST and PUT require `name` and `email` to be nonempty strings after trimming. PUT updates both fields and retains the ID. IDs must be positive integers: malformed IDs return `400`, and valid IDs without a matching user return `404`. The server generates increasing IDs, so deleting a user does not cause an ID to be reused.

```bash
curl -i -X POST http://localhost:3000/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sara","email":"sara@example.com"}'
```

Example response:

```json
{"id":1,"name":"Sara","email":"sara@example.com"}
```

## Lab 5.2: Trips

Base route: `/trips`. `/api/v1/trips` is an alias using the **same router and data**, including the required `/api/v1/trips/compare` endpoint. The short `/trips/compare` route also works.

| Method | Endpoint | Access | Successful result |
| --- | --- | --- | --- |
| GET | `/trips` | Public | `200`, trip list |
| GET | `/trips/:id` | Public | `200`, matching trip |
| POST | `/trips` | `x-role: admin` | `201`, new trip |
| PUT | `/trips/:id` | `x-role: admin` | `200`, updated trip |
| DELETE | `/trips/:id` | `x-role: admin` | `204`, empty body |
| POST | `/api/v1/trips/compare` | Public | `200`, cost comparison |

Trip success responses use `{ "status": "success", "data": ... }`. List responses also include `results`. Error responses include a `message`.

POST requires a nonempty `destination`, a nonempty `country`, and a finite numeric `cost` greater than zero. Strings are trimmed. PUT accepts one or more supported fields and validates each provided value. Invalid input returns `400` without changing stored trips. Missing records return `404`.

`verifyAdmin` runs before trip validation on protected routes. A missing role, `x-role: user`, or any value other than exactly `admin` returns `403` with `{"message":"Admin access required"}`. Rejected requests do not change data. **This header is a classroom mock, not real authentication:** clients can set it freely. Real applications need a verified login/session.

`logRequest` runs before Trips routes and logs each request's HTTP method and URL, for example `POST /trips` or `GET /api/v1/trips`.

Create a trip:

```bash
curl -i -X POST http://localhost:3000/trips \
  -H 'Content-Type: application/json' \
  -H 'x-role: admin' \
  -d '{"destination":"Rome","country":"Italy","cost":500}'
```

Compare two existing trips without an admin header:

```bash
curl -i -X POST http://localhost:3000/api/v1/trips/compare \
  -H 'Content-Type: application/json' \
  -d '{"tripId1":1,"tripId2":2}'
```

With the initial records, the comparison's `data` is:

```json
{
  "destination1": "Paris",
  "destination2": "Tokyo",
  "costDifference": 400,
  "cheaperDestination": "Paris",
  "message": "Paris is cheaper than Tokyo"
}
```

Comparison IDs must be two different positive integer **numbers**, or the response is `400`. An unknown ID returns `404`. Equal costs return a difference of zero, `cheaperDestination: null`, and a message that neither trip is cheaper. Comparison never adds, updates or deletes a trip.

## Postman checks

Import both files into Postman:

- `postman/Lab5.postman_collection.json`
- `postman/Local.postman_environment.json`

Select **Lab 5 Local**, start the server, and run the **entire collection in order**. If you changed the server port, update the environment's `baseUrl`. The collection captures initial records, creates temporary users/trips, asserts results, and deletes its temporary records at the end. Run it against a development instance without concurrent changes.

The 70 requests cover Users CRUD, invalid fields and IDs, unknown users, verifying updates, and unique IDs after deletion. Trips checks cover public reads, missing/user/case-sensitive roles, middleware ordering, invalid costs and strings, no changes after rejected requests, permitted admin CRUD, both route aliases, unequal/equal comparisons and unknown comparison IDs. To see the required GET and POST logs, watch the server terminal during the run.

With Postman CLI on your PATH:

```bash
postman collection run postman/Lab5.postman_collection.json \
  -e postman/Local.postman_environment.json
```

On the original development machine, the CLI is installed at `/Users/ahmedhazem/.local/bin/postman`:

```bash
/Users/ahmedhazem/.local/bin/postman collection run \
  postman/Lab5.postman_collection.json \
  -e postman/Local.postman_environment.json
```

For a short lab demonstration, show a public `GET /trips`, a valid admin POST (`201`), a POST with `x-role: user` (`403`), and an admin POST with `cost: 0` (`400`).

## Submission

The repository includes source code, middleware, package files, automated tests, the Postman collection and original starter-code reference copies. `node_modules/` is excluded by `.gitignore`. Clone the repository and run `npm ci` to install the exact dependency versions in `package-lock.json`.

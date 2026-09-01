# Exercise Weight Logs API

## Purpose

Persist a general record of the load a client moved in one exercise. A record has one weight value, a date, and an optional note; it does not represent an individual set.

## Environment URLs

The client composes every request from `environment.apiBase`.

| Environment | Base URL | Resource |
| --- | --- | --- |
| Development | `https://4e3slegwi9.execute-api.us-east-1.amazonaws.com/dev` | `/clients/exercise-weight-logs` |
| Production | `https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/prod` | `/clients/exercise-weight-logs` |

The API Gateway authorizer must accept the Cognito ID token sent as `Authorization: Bearer <id-token>`. The backend obtains the client identity from that token and must never accept a client ID supplied by the request.

## Data Model

```json
{
  "id": "log-uuid",
  "planId": "plan-123",
  "sessionIndex": 0,
  "exerciseId": "exercise-456",
  "exerciseIndex": 2,
  "weightKg": 42.5,
  "recordedAt": "2026-08-30",
  "note": "Buena tecnica, aumentar la proxima vez.",
  "createdAt": "2026-08-30T12:15:00.000Z",
  "updatedAt": "2026-08-30T12:15:00.000Z"
}
```

`exerciseId` is optional because existing plan data can omit it. The pair `planId`, `sessionIndex`, and `exerciseIndex` is required and identifies the exercise in the assigned plan.

## Endpoints

### List an exercise history

`GET /clients/exercise-weight-logs?planId={planId}&sessionIndex={sessionIndex}&exerciseIndex={exerciseIndex}`

Returns `200 OK` and an array of records belonging only to the authenticated client. Return records ordered by `recordedAt` descending, then `createdAt` descending.

### Create a record

`POST /clients/exercise-weight-logs`

```json
{
  "planId": "plan-123",
  "sessionIndex": 0,
  "exerciseId": "exercise-456",
  "exerciseIndex": 2,
  "weightKg": 42.5,
  "recordedAt": "2026-08-30",
  "note": "Buena tecnica, aumentar la proxima vez."
}
```

Returns `201 Created` with the created record.

Validate `weightKg` as a finite number greater than `0` and no greater than `2000`; validate `recordedAt` as an ISO date (`YYYY-MM-DD`); accept a trimmed optional `note` up to 500 characters. The client accepts kg or lb and converts lb to `weightKg` before the request, so the API always stores kilograms as the canonical unit. Validate that the plan and exercise context belongs to the authenticated client before persisting.

## Error Responses

Return JSON in this shape:

```json
{
  "message": "Human-readable error message",
  "code": "VALIDATION_ERROR"
}
```

Use `400` for invalid payloads, `401` for absent or invalid tokens, `403` for a resource outside the client scope, `404` for an unknown plan or exercise context, and `500` for unexpected failures. Configure CORS to allow `GET`, `POST`, and `OPTIONS` from the development and production client origins.
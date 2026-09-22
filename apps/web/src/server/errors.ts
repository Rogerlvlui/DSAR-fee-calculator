// apps/web/src/server/errors.ts
//
// Plain Error subclasses carrying a `status` number, following
// packages/rulepacks/src/loader.ts's plain-subclass precedent rather than
// inventing a code/detail convention this app does not need yet.
// `errorToResponse` is the one place every route handler maps a thrown
// error to an HTTP status + JSON body, so the mapping lives in one place
// rather than being re-derived by each of the three route handlers.

import "./server-only.ts";
import { ZodError } from "zod";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isStatusCarryingError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof ValidationError
  );
}

// Every route handler's catch block delegates here: read and parse the JSON
// body, resolve the actor, call the one data-layer function, map the
// outcome to a status code — on a thrown error, the status the error
// carries, with a JSON body carrying the message.
export function errorToResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
  }
  if (isStatusCarryingError(error)) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json({ error: message }, { status: 500 });
}

// packages/engine's public surface. assess() is PRD §8.1's orchestrator;
// AssessPreconditionFailure/AssessPreconditionError(Code) is the typed
// refusal a caller can switch on exhaustively; ENGINE_VERSION is stamped
// onto every Assessment this package produces (Assessment.engineVersion).

export { assess, ENGINE_VERSION, type AssessInput } from "./assess.ts";
export {
  AssessPreconditionFailure,
  type AssessPreconditionError,
  type AssessPreconditionErrorCode,
} from "./errors.ts";

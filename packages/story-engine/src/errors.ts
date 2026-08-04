export type EngineErrorCode =
  | 'unknown-scene'
  | 'unknown-choice'
  | 'choice-unavailable'
  | 'story-mismatch'
  | 'empty-history';

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

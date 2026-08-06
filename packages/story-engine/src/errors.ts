export type EngineErrorCode =
  | 'unknown-scene'
  | 'unknown-choice'
  /** The link targets a node that is not a choice: there is nothing to answer. */
  | 'not-a-choice'
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

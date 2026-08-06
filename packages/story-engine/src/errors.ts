export type EngineErrorCode =
  | 'unknown-scene'
  | 'unknown-choice'
  /** Le lien vise un noeud qui n'est pas un choix : on n'y « repond » pas. */
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

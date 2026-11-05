export type CommandErrorCategory =
  | 'invalid-input'
  | 'unauthenticated'
  | 'forbidden'
  | 'version-conflict'
  | 'business-rejected'
  | 'dependency-failure'
  | 'internal-failure';

export interface CommandError {
  readonly category: CommandErrorCategory;
  /** Stable, non-sensitive identifier defined by the owning module. */
  readonly code: string;
  readonly requestId: string;
}

export type CommandResult<TValue> =
  | { readonly status: 'succeeded'; readonly requestId: string; readonly value: TValue }
  | { readonly status: 'rejected'; readonly requestId: string; readonly error: CommandError }
  | { readonly status: 'failed'; readonly requestId: string; readonly error: CommandError }
  | { readonly status: 'processing'; readonly requestId: string }
  | { readonly status: 'unknown'; readonly requestId: string };

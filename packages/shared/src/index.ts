export type FoundationTarget = 'weapp' | 'web';

export interface FoundationBuildMetadata {
  readonly target: FoundationTarget;
  readonly stage: 'foundation';
}

export const FOUNDATION_STAGE = 'foundation' as const;

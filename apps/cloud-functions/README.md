# Cloud function workspace

This workspace is reserved for SP08 implementation work. It currently contains a local Node.js SHA-256 adapter used by the shared idempotency ID contract and its strict TypeScript check. This adapter is not a callable CloudBase function and does not connect to a cloud environment.

There is no CloudBase SDK dependency, environment identifier, secret, deployable function entrypoint, deployment script, or production configuration. Select and validate SDK calls, data contracts, and server-side enforcement against the actual CloudBase environment in SP08 before adding executable functions. `npm run check --workspace @xianglin/cloud-functions` performs only local strict TypeScript checking.

The `miniprogram/` QuickStart directory remains separate and is not a workspace or product implementation source.

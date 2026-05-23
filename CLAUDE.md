# StockFlow Development Guidelines

## Package Manager
The project is strictly configured to use **pnpm** as the official package manager. 
- Do **not** use `npm` or `yarn`. 
- Do **not** commit `package-lock.json` or `yarn.lock`.
- Always run `pnpm install` to update dependencies.

## Build and Verification Commands
- Install dependencies: `pnpm install`
- Start development server: `pnpm dev`
- Build production assets: `pnpm build`
- Typecheck and Lint: `pnpm lint`
- Build Cloud Functions: `pnpm --prefix functions build`
- Run Admin Bootstrap Script: `pnpm tsx scripts/bootstrap-admin.ts <email>`

## Architecture Notes
- All unifed components must be stored in `src/shared/components/`. The folder `src/components/` is deprecated and deleted.
- Code-splitting is configured via `React.lazy` and `Suspense` in `src/App.tsx` and `src/apps/admin/routes.tsx`.
- Security claims/roles logic is centralized in `src/lib/roles.ts`. Never hardcode user emails for security bypasses.

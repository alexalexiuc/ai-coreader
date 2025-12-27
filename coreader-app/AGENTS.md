## Local setup

- Start MongoDB before running the app. `MONGODB_URI` defaults to `mongodb://localhost:27017`.
- On an empty database, run `npm run db:migrate` to create the required collections.
- `npm run dev:e2e` calls `scripts/ensure-mongo.cjs`, which checks `MONGODB_URI` and starts a local Docker MongoDB (`coreader-mongo`) if `localhost:27017` is not reachable.

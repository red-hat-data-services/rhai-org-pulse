# Org Pulse: MongoDB migration design

*Giulia Naponiello | 16th July 2026*

## Contents

1. [Motivation](#1-motivation)
2. [Architecture](#2-architecture)
3. [Module isolation and write safety](#3-module-isolation-and-write-safety)
4. [Data modeling](#4-data-modeling)
5. [Storage function mapping](#5-storage-function-mapping)
6. [Migration strategy](#6-migration-strategy)
7. [Consumer repo transition](#7-consumer-repo-transition)
8. [External data collectors](#8-external-data-collectors)
9. [Database ownership and accountability](#9-database-ownership-and-accountability)
10. [Local development, demo mode, and testing](#10-local-development-demo-mode-and-testing)
11. [Deployment and operations](#11-deployment-and-operations)
12. [Delivery plan](#12-delivery-plan)

## 1. Motivation

Org Pulse stores all persistent data as JSON files on a PVC, accessed through a `readFromStorage`/`writeToStorage` abstraction. This was a practical starting point, but it limits us: there's no way to query across documents efficiently, no built-in atomicity for concurrent writes, and the application-level mutexes we added in the async I/O refactor (core PR #29) are a workaround for problems a database solves natively.

The AIPCC Dashboard already runs MongoDB successfully on OpenShift with a proven deployment pattern (standalone pod, PVC, Vault-synced secrets). We would follow the same approach, adapted for Org Pulse's two-layer architecture: a core platform package (`@org-pulse/core`) consumed by a separate repo with feature modules.

The goal is to replace all JSON file storage with MongoDB — not just for modules, but for core platform data too (roles, teams, roster, audit log, etc.). Once complete, the `readFromStorage`/`writeToStorage` abstraction and the `async-mutex` concurrency layer would both be removed.

## 2. Architecture

### Database and ODM

We would use **MongoDB** as the database and **Mongoose** as the ODM. Mongoose is the Node.js analog of the dashboard's Beanie — it gives us schema definitions with validation, declared indexes, and a managed connection lifecycle. Our data is already document-shaped JSON, so there's no impedance mismatch.

### Where the database layer lives

The DB layer would live in `org-pulse-core`, not in the consumer repo. Core already owns the module context — it provides storage, auth, role store, and secrets to every module via `buildModuleContext()`. The database is a platform-level service that belongs alongside them. Core's `startServer()` would connect to MongoDB early in its startup sequence and close the connection on `SIGTERM`/`SIGINT`.

### Module API surface

Each module would receive a `context.db` object with a `model(name, schema)` factory. Calling it returns a standard Mongoose model bound to a namespaced collection. For example, a module with slug `releases` calling `context.db.model('features', schema)` would get a model operating on the `releases__features` collection. Modules get full Mongoose query power — find, aggregate, populate within their own models — without learning a custom API.

## 3. Module isolation and write safety

> **Key design invariant:** a module must never be able to corrupt or interfere with another module's data — whether through a bug, a careless query, or a misunderstanding of the schema.

This is enforced through two independent layers:

**Layer 1 — database-level namespacing.** The `context.db.model()` factory automatically prefixes collection names with the module's slug. A module physically cannot create or access collections outside its namespace. There is no "escape hatch" — the scoped factory is the only database handle a module receives.

**Layer 2 — API-level gatekeeping.** When module A needs data owned by module B, the request goes through module B's HTTP API endpoints — for both reads and writes. Module B validates the input and decides whether to accept the write. This is the same pattern we use today for cross-module writes (e.g., AI Impact pushing review data to the releases module via its bulk API endpoint), now extended to reads as well.

The old cross-module read shortcut — where a module could call `readFromStorage()` on another module's exported files — goes away. The HTTP-only pattern is a simpler mental model: if you want another module's data, call its API.

## 4. Data modeling

### Collection naming

Platform collections use a `core__` prefix: `core__roles`, `core__teams`, `core__people`, `core__config`. Module collections use their slug: `releases__features`, `ai-impact__assessments`. The `team-tracker` module follows the module convention (`team-tracker__`) even though it ships with core — it's registered as a module with its own slug and routes.

### Schema ownership

Core defines Mongoose models for platform data in core's codebase. Each module defines its own models in its `server/models/` directory. Module contributors only need knowledge of their own schemas — they don't touch core and don't coordinate with other module authors.

### Entity modeling

Each domain entity gets its own Mongoose model and collection. Today's file-per-entity patterns (like `people/bob_smith.json`) would be flattened into proper collections — each person becomes a document in `core__people` with a key field. Nested directory structures (like `snapshots/{team}/{date}.json`) become documents with `team` and `date` fields. Maps like `registry.json` get each entry as its own document.

Small singleton configs (site config, module state, messages) would share a single `core__config` collection keyed by config name, rather than each getting its own collection for one document.

### Indexes

Each Mongoose schema would declare its indexes as part of the schema definition. Mongoose runs `ensureIndexes` on startup, which creates any missing indexes automatically. Collections like `core__people` (currently hundreds of individual files) would have indexes on their key fields to avoid full collection scans. This is part of the schema definition — module authors declare indexes alongside their schemas, and Mongoose handles the rest.

### Concurrency

The application-level mutexes introduced in core PR #29 would be dropped entirely. MongoDB's atomic operations (`$set`, `$push`, `findOneAndUpdate`) handle single-document atomicity natively. For multi-document operations (like deleting a team and removing its references), we would accept eventual consistency — delete the primary document, then clean up references, handling dangling refs gracefully if the process is interrupted.

## 5. Storage function mapping

The current storage module exports eight functions. `writeToStorageAtomic` was already removed in core PR #29. The remaining seven map to MongoDB as follows:

| Current function | MongoDB replacement |
|---|---|
| `readFromStorage(key)` | `Model.findOne()` or `Model.find()` depending on the data shape |
| `writeToStorage(key, data)` | `Model.create()`, `Model.updateOne()`, or `Model.findOneAndUpdate()` with upsert |
| `deleteFromStorage(key)` | `Model.deleteOne()` |
| `listStorageFiles(dir)` | `Model.find()` with projections, or `Model.distinct('key')` |
| `deleteStorageDirectory(dir)` | `Model.deleteMany()` or `collection.drop()` |
| `getFileMtime(key)` | Mongoose `timestamps: true` on schemas — every document gets an `updatedAt` field automatically |
| `initStorage({ dataDir })` | `mongoose.connect(uri)` in the startup sequence |

Each core store migration PR (Phase 2) would replace the specific storage calls in that store with the corresponding Mongoose operations.

## 6. Migration strategy

### Incremental delivery

The work would land in phases. The first PR adds the database infrastructure to core — Mongoose connection lifecycle, the scoped `context.db.model()` factory, and demo/test support. This is published as a transitional core version where MongoDB is **optional** — consumer repos can upgrade to get the new `context.db` API without being forced to set up a database (see [Consumer repo transition](#7-consumer-repo-transition)). Subsequent PRs migrate core stores one by one: role store, team store, field store, audit log, roster, snapshots, contributions. Each store migration is a self-contained PR. Once all stores are migrated, the final PR removes `readFromStorage`/`writeToStorage` and `async-mutex`.

### Automatic startup migration

On first deployment, the server would detect an empty MongoDB alongside a populated `data/` directory on the PVC. It would read the existing JSON files, insert them into the appropriate collections, and mark the migration as complete via a version marker in a `_migrations` collection. Subsequent startups skip the migration.

The JSON files on the PVC are **not deleted** after migration. They serve as a natural safety net: if something goes wrong, we wipe the database, fix the bug, redeploy, and the auto-migration runs again from the same source files.

## 7. Consumer repo transition

`@org-pulse/core` is consumed as an npm package by multiple repos, each with their own modules and `data/` directories. Requiring MongoDB immediately on core upgrade would block adoption — not every consumer repo can set up a database at the same time they bump the package version.

To address this, core would ship a **transitional major version** where MongoDB is optional. In this version:

- The `context.db` API is available for modules that want to start using it.
- The existing `readFromStorage`/`writeToStorage` abstraction continues to work for modules and stores that haven't migrated yet.
- If `MONGODB_URI` is not set, `context.db` is `null` and the app runs in file-only mode — exactly like today.
- If `MONGODB_URI` is set, modules can use `context.db` while core stores still use files.

This means consumer repos can upgrade core at their own pace: first upgrade to the transitional version (no database needed), then set up MongoDB and start migrating their modules whenever they're ready. The final core version that *removes* the file-based storage would be a separate major bump, giving consumers a clear signal that MongoDB is now required.

## 8. External data collectors

Some modules have external collectors — processes running in separate pods, namespaces, or even separate clusters — that produce data for the app. The proposal doesn't require these collectors to connect to MongoDB directly. Today, external collectors push data via the app's HTTP API endpoints (e.g., `POST /api/modules/releases/execution/ai-review/bulk`), and the app backend writes to storage. With MongoDB, the only thing that changes is what the backend writes *to* — the external collector still calls the same API, and the backend handler writes to MongoDB instead of a JSON file.

No external process needs direct database access. MongoDB only needs to be reachable from the app's backend pod, not from external collectors. The API remains the boundary.

## 9. Database ownership and accountability

An alternative to a shared database is per-module databases — each module team runs their own MongoDB instance, owning their uptime, backups, and capacity independently. We considered this and decided against it. Many module contributors are not deeply technical — they contribute views and logic but don't have the capacity or expertise to operate a database. Per-module databases would also mean running 10+ MongoDB instances with separate PVCs, backup jobs, and Vault secrets, growing with every new module. The operational overhead doesn't match the team's structure.

Instead, we would use a single shared MongoDB instance with collection-level isolation (via the scoped `context.db.model()` factory). Module teams own their schemas, queries, and data logic. The database infrastructure itself — HA, backups, monitoring, upgrades — would be handled by the [IT-managed database service](https://source.redhat.com/departments/strategy_and_operations/it/gcadba), a specialized SRE team that already supports MongoDB. This avoids the org-pulse platform team having to own database operations on top of building features, and gives us professionally managed HA, geo-redundancy, and backup capabilities out of the box.

This separation of concerns is intentional and designed for the long term: the application design (module isolation, scoped access, schema ownership) doesn't depend on who operates the database. If the organizational structure changes, the managed service model still holds.

## 10. Local development, demo mode, and testing

### Local development

Two options would be supported for local MongoDB:

- **Docker/Podman compose** — A compose file starts a MongoDB container. Data persists between restarts via a named volume, giving a realistic dev experience closer to production.
- **`mongodb-memory-server`** — An in-process ephemeral MongoDB instance that requires no containers at all. Starts automatically when `MONGODB_URI` is not set and `DEMO_MODE` is not enabled. Data is lost on restart, but there's zero setup friction — just run `npm run dev:full`.

Both options use the same default connection credentials, so no `.env` changes are needed either way. Contributors who prefer containers get persistence; contributors who want zero infrastructure get `mongodb-memory-server`.

### Demo mode

Demo mode would use `mongodb-memory-server` — an in-process ephemeral MongoDB instance. Existing fixture JSON files get seeded into in-memory collections on startup. Modules would declare their fixture-to-collection mapping in `module.json` under a `fixtures` section. Queries, indexes, and aggregations work identically to production — no mocks, no fakes.

### Testing

Tests would share a single `mongodb-memory-server` instance across the entire test run, started once in a Vitest global setup hook. Each test suite gets a unique database name for isolation — a fresh database that's dropped in `afterAll`. The `createTestContext()` helper would be updated to include `context.db` with the same scoped model factory used in production.

## 11. Deployment and operations

### OpenShift topology

MongoDB would be provisioned through the IT-managed database service rather than as a self-managed standalone pod. The managed service handles HA, backups, monitoring, and upgrades. The org-pulse backend connects via `MONGODB_URI` provided by the managed service — from the application's perspective, it's just a connection string.

### Kustomize manifests

Deployment manifests for the MongoDB infrastructure would be included in `org-pulse-core` alongside the existing kustomize layers. This covers the service binding, any ConfigMap entries for `DB_NAME`, and the Vault secret reference for `MONGODB_URI`. Consumer repos inherit these through the kustomize overlay chain.

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Production only | `mongodb://mongoadmin:mongopassword@localhost:27017` | MongoDB connection string |
| `DB_NAME` | No | `org-pulse` | Database name |

### Backups

Backups would be handled by the IT-managed database service as part of their standard offering. If additional application-level backups are needed (e.g., for point-in-time snapshots tied to deployments), the existing backup refresh handler could be adapted to run `mongodump` on its daily cadence.

## 12. Delivery plan

**Phase 1 — Database infrastructure (transitional core version).** Add Mongoose to core. Wire up the connection lifecycle in `startServer()`, build the scoped `context.db.model()` factory, set up `mongodb-memory-server` for demo mode and tests, add the compose file for local dev. MongoDB is optional in this version — if `MONGODB_URI` is not set, `context.db` is `null` and the app runs on file storage as before. Published as a new major core version so consumer repos can upgrade at their own pace.

**Phase 2 — Core store migration.** Migrate platform stores to Mongoose models one by one: roles, teams, registry, field definitions, roster, people metrics, snapshots, contributions, audit log, config singletons. Each store is a separate PR. The auto-migration logic (JSON files → MongoDB on first startup) lands here. During this phase, MongoDB becomes required — `startServer()` fails with a clear error if `MONGODB_URI` is not set.

**Phase 3 — Cleanup.** Remove `readFromStorage`, `writeToStorage`, `demo-storage.js`, `storage-mutex.js`, and the `async-mutex` dependency. Published as another major core version, signaling to all consumers that MongoDB is now required. Update documentation and migration guides.

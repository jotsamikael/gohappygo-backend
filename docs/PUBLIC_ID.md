# Public ID (Phase 1)

Opaque, prefixed ULIDs for client-facing resources. **Numeric `id` fields and all URL/query params are unchanged in this phase.**

## Format

`{prefix}_{ulid}` — example: `us_01ARZ3NDEKTSV4RRFFQ69G5FAV`

| Entity | Prefix |
|--------|--------|
| User | `us` |
| Request | `rq` |
| Travel | `tr` |
| Demand | `dm` |
| Transaction | `tx` |
| Review | `rv` |
| Message | `ms` |
| Notification | `nt` |
| Alert | `at` |
| Bookmark | `bm` |
| Support request | `sp` |
| Airport | `ap` |
| Airline | `al` |
| Currency | `cu` |
| Uploaded file | `uf` |
| Delivery proof | `dp` |

## API (Phase 1)

- Responses include **`publicId`** alongside existing **`id`**
- Endpoints still accept numeric ids only (e.g. `GET /api/auth/me?userId=38`)
- Frontend/mobile may start storing `publicId` for future deep links

## Database setup

### Development

1. Restart Nest (TypeORM sync adds nullable `publicId` columns)
2. For uploaded files, if sync fails on rename: run the uploaded-file section of `sql/public-id-migration.sql`
3. Backfill existing rows:

```bash
npm run backfill:public-ids
```

### Production

1. Run `sql/public-id-migration.sql`
2. `npm run backfill:public-ids`
3. Apply NOT NULL constraints from the bottom of the migration file

## Uploaded files note

Cloudinary’s identifier was renamed from `publicId` to **`cloudinaryPublicId`** on `uploaded_file_entity`. The new **`publicId`** column is the external GoHappyGo identifier (`uf_...`).

## Phase 2 (later)

- Accept `publicId` in path/query params
- Deprecate numeric `id` in public URLs
- Coordinate with frontend and mobile before endpoint changes

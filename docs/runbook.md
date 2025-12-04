# Operational Runbook

## Database Migrations
- **Apply Migrations (Production)**: `npx prisma migrate deploy`
- **Create Migration (Dev)**: `npx prisma migrate dev`
- **Reset Database (Dev)**: `npx prisma migrate reset` (WARNING: Wipes all data)

## Scaling
- **Event Workers**: Run multiple instances of `server/src/workers/eventProcessor.ts`.
  - `pm2 start dist/workers/eventProcessor.js -i max`
- **Redis**: Ensure Redis is configured for high availability (Cluster mode) if load increases.
- **Database**: Use PgBouncer for connection pooling.

## Archival
- **Archive Old Partitions**: Run `ts-node src/scripts/archivePartitions.ts`.
  - This script identifies partitions older than 1 year, exports them to Parquet (mocked), uploads to S3 (mocked), and drops the partition.

## Search
- **Re-index All Tracks**: `npx ts-node src/scripts/indexTracks.ts`
- **Meilisearch Dashboard**: Accessible at `http://localhost:7700` (Master Key: `masterKey123`)

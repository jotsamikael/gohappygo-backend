import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { PublicIdPrefix } from '../src/common/public-id/public-id-prefix.enum';
import { generatePublicId } from '../src/common/public-id/public-id.util';

config();

const BATCH_SIZE = 1000;

const TABLE_CONFIG: Array<{ table: string; prefix: PublicIdPrefix }> = [
  { table: 'user_entity', prefix: PublicIdPrefix.USER },
  { table: 'request_entity', prefix: PublicIdPrefix.REQUEST },
  { table: 'travel_entity', prefix: PublicIdPrefix.TRAVEL },
  { table: 'demand_entity', prefix: PublicIdPrefix.DEMAND },
  { table: 'transaction_entity', prefix: PublicIdPrefix.TRANSACTION },
  { table: 'review_entity', prefix: PublicIdPrefix.REVIEW },
  { table: 'message_entity', prefix: PublicIdPrefix.MESSAGE },
  { table: 'notification', prefix: PublicIdPrefix.NOTIFICATION },
  { table: 'alert_entity', prefix: PublicIdPrefix.ALERT },
  { table: 'bookmark_entity', prefix: PublicIdPrefix.BOOKMARK },
  { table: 'support_request_entity', prefix: PublicIdPrefix.SUPPORT_REQUEST },
  { table: 'airport_entity', prefix: PublicIdPrefix.AIRPORT },
  { table: 'airline_entity', prefix: PublicIdPrefix.AIRLINE },
  { table: 'currency_entity', prefix: PublicIdPrefix.CURRENCY },
  { table: 'delivey_proof_entity', prefix: PublicIdPrefix.DELIVERY_PROOF },
  { table: 'uploaded_file_entity', prefix: PublicIdPrefix.UPLOADED_FILE },
];

async function backfillTable(dataSource: DataSource, table: string, prefix: PublicIdPrefix): Promise<number> {
  let totalUpdated = 0;

  while (true) {
    const rows: Array<{ id: number }> = await dataSource.query(
      `SELECT id FROM ${table} WHERE publicId IS NULL LIMIT ?`,
      [BATCH_SIZE],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const publicId = generatePublicId(prefix);
      await dataSource.query(`UPDATE ${table} SET publicId = ? WHERE id = ?`, [publicId, row.id]);
      totalUpdated += 1;
    }

    console.log(`  ${table}: updated ${totalUpdated} rows so far...`);
  }

  return totalUpdated;
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await dataSource.initialize();
  console.log('Connected to database. Starting publicId backfill...');

  try {
    for (const { table, prefix } of TABLE_CONFIG) {
      console.log(`Backfilling ${table} (${prefix})...`);
      const count = await backfillTable(dataSource, table, prefix);
      console.log(`Finished ${table}: ${count} rows updated.`);
    }

    console.log('Backfill complete.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});

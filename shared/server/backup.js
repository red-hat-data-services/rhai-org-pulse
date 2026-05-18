/**
 * S3 backup and restore for the data/ directory.
 *
 * Backs up the entire data directory as a tar.gz archive to S3 with
 * tiered retention: 7 daily + 4 weekly (Sunday backups kept 28 days).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_PREFIX = 'team-tracker/';

const RETENTION = {
  dailyCount: 7,
  weeklyDays: 28,
};

function getS3Client() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_BACKUP_BUCKET;
  if (!bucket) {
    throw new Error('AWS_BACKUP_BUCKET env var is not set');
  }
  const client = new S3Client({ region });
  return { client, bucket };
}

function formatDate(date) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function isSunday(dateStr) {
  const d = new Date(dateStr.replace(/T.*/, ''));
  return d.getUTCDay() === 0;
}

/**
 * Create a tar.gz of the data directory and upload to S3.
 * @returns {{ key: string, sizeBytes: number }} S3 key and archive size
 */
async function createBackup() {
  const timestamp = formatDate(new Date());
  const filename = `backup-${timestamp}.tar.gz`;
  const s3Key = `${BACKUP_PREFIX}${filename}`;
  const tmpFile = path.join(os.tmpdir(), filename);

  try {
    // Create tar.gz of the data directory
    execFileSync('tar', [
      'czf', tmpFile,
      '-C', path.dirname(DATA_DIR),
      path.basename(DATA_DIR),
    ]);

    const stats = fs.statSync(tmpFile);
    console.log(`[backup] Created archive: ${filename} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

    // Upload to S3
    const { client, bucket } = getS3Client();
    const body = fs.createReadStream(tmpFile);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: 'application/gzip',
    }));

    console.log(`[backup] Uploaded to s3://${bucket}/${s3Key}`);
    return { key: s3Key, sizeBytes: stats.size };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * List all backups in S3, sorted newest-first.
 * @returns {Array<{ key: string, date: string, sizeBytes: number }>}
 */
async function listBackups() {
  const { client, bucket } = getS3Client();
  const backups = [];
  let continuationToken;

  do {
    const resp = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: BACKUP_PREFIX,
      ContinuationToken: continuationToken,
    }));

    for (const obj of (resp.Contents || [])) {
      const match = obj.Key.match(/backup-(\d{4}-\d{2}-\d{2})T/);
      if (match) {
        backups.push({
          key: obj.Key,
          date: match[1],
          sizeBytes: obj.Size,
          lastModified: obj.LastModified,
        });
      }
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  backups.sort((a, b) => b.key.localeCompare(a.key));
  return backups;
}

/**
 * Apply tiered retention policy: keep 7 most recent daily + Sundays for 28 days.
 * @returns {{ deleted: string[] }} keys that were deleted
 */
async function applyRetention() {
  const backups = await listBackups();
  if (backups.length === 0) return { deleted: [] };

  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - RETENTION.weeklyDays);

  const toKeep = new Set();

  // Keep the N most recent daily backups
  for (let i = 0; i < Math.min(RETENTION.dailyCount, backups.length); i++) {
    toKeep.add(backups[i].key);
  }

  // Keep Sunday backups within the weekly retention window
  for (const b of backups) {
    if (new Date(b.date) >= cutoffDate && isSunday(b.date)) {
      toKeep.add(b.key);
    }
  }

  const toDelete = backups.filter(b => !toKeep.has(b.key));
  if (toDelete.length === 0) return { deleted: [] };

  const { client, bucket } = getS3Client();
  // S3 DeleteObjects supports up to 1000 keys per call
  const batchSize = 1000;
  const deletedKeys = [];
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map(b => ({ Key: b.key })) },
    }));
    deletedKeys.push(...batch.map(b => b.key));
  }

  console.log(`[backup] Retention applied: deleted ${deletedKeys.length} old backups`);
  return { deleted: deletedKeys };
}

/**
 * Download a backup from S3 and extract it over the data directory.
 * @param {string} key - The S3 key to restore from
 * @returns {{ key: string, restoredAt: string }}
 */
async function restoreBackup(key) {
  const { client, bucket } = getS3Client();
  const tmpFile = path.join(os.tmpdir(), 'restore.tar.gz');

  try {
    const resp = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));

    await pipeline(resp.Body, fs.createWriteStream(tmpFile));

    console.log(`[backup] Downloaded s3://${bucket}/${key}`);

    // Extract over the data directory
    execFileSync('tar', [
      'xzf', tmpFile,
      '-C', path.dirname(DATA_DIR),
    ]);

    console.log(`[backup] Restored data directory from ${key}`);
    return { key, restoredAt: new Date().toISOString() };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

module.exports = {
  createBackup,
  listBackups,
  applyRetention,
  restoreBackup,
};

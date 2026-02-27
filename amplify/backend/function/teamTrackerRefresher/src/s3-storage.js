const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET;

/**
 * Read JSON from S3
 * @param {string} key - S3 key (e.g., 'boards.json' or 'sprints/123.json')
 * @returns {object|null} Parsed JSON or null if not found
 */
async function readFromS3(key) {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);
    const body = await response.Body.transformToString();
    return JSON.parse(body);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Write JSON to S3
 * @param {string} key - S3 key
 * @param {object} data - Data to write
 */
async function writeToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });
  await s3Client.send(command);
}

module.exports = { readFromS3, writeToS3 };

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { performRefresh } = require('./app');

const ssmClient = new SSMClient({ region: process.env.REGION || 'us-east-1' });

exports.handler = async function (event) {
  console.log('Refresher Lambda invoked:', JSON.stringify(event));

  const hardRefresh = event.hardRefresh || false;
  const paramName = process.env.JIRA_TOKEN_PARAMETER_NAME
    || `/team-tracker-app/${process.env.ENV || 'dev'}/jira-token`;

  try {
    // Read Jira token from SSM
    const ssmCommand = new GetParameterCommand({
      Name: paramName,
      WithDecryption: true
    });
    const ssmResponse = await ssmClient.send(ssmCommand);
    const jiraToken = ssmResponse.Parameter.Value;

    await performRefresh({ hardRefresh, jiraToken });

    return { statusCode: 200, body: 'Refresh complete' };
  } catch (error) {
    console.error('Refresher Lambda error:', error);

    // Write error status to S3
    const { writeToS3 } = require('./s3-storage');
    await writeToS3('refresh-status.json', {
      type: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
};

#!/usr/bin/env groovy

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import java.time.Instant

String baseUrl = (System.getenv('ORG_PULSE_URL') ?: 'http://127.0.0.1:3001').replaceAll('/+$', '')
String tokenFile = System.getenv('ORG_PULSE_API_TOKEN_FILE')
String token = tokenFile ? new File(tokenFile).text.trim() : System.getenv('ORG_PULSE_API_TOKEN')
if (!token) throw new IllegalArgumentException('Set ORG_PULSE_API_TOKEN_FILE or ORG_PULSE_API_TOKEN')

int buildNumber = (System.getenv('SIM_BUILD_NUMBER') ?: '900001') as int
String version = System.getenv('SIM_RELEASE_VERSION') ?: '3.6'
String job = 'components/dashboard/dashboard-e2e-tests-local-sim'
Map jenkins = [
  instance: 'local-simulator',
  job: job,
  buildNumber: buildNumber,
  buildUrl: "https://example.invalid/jenkins/job/dashboard-e2e-tests-local-sim/${buildNumber}/"
]
Instant completedAt = Instant.now()

Map run = [
  schemaVersion: 1,
  jenkins: jenkins,
  reporting: [stream: 'release'],
  run: [
    result: 'FAILURE',
    displayName: "#${buildNumber} local simulation",
    startedAt: completedAt.minusSeconds(1200).toString(),
    completedAt: completedAt.toString(),
    durationMs: 1200000
  ],
  release: [product: 'RHOAI', version: version, installedVersion: "${version}.0"],
  environment: [name: 'GCP', clusterName: 'local-simulation', clusterType: 'selfmanaged'],
  trigger: [causes: [[kind: 'timer']]],
  tests: [
    collectionState: 'complete',
    suiteCount: 1,
    counts: [passed: 48, failed: 2, skipped: 1],
    failedCases: [
      [suite: 'model-serving', name: 'deploys a model', status: 'failed'],
      [suite: 'model-serving', name: 'checks model endpoint', status: 'failed']
    ]
  ]
]
Map analysis = [
  schemaVersion: 1,
  jenkins: jenkins.subMap(['instance', 'job', 'buildNumber']),
  analysis: [
    producedAt: completedAt.plusSeconds(60).toString(),
    summary: 'The simulated model serving checks failed.',
    findings: [[
      id: 'model-serving-failure',
      category: 'product-defect',
      suggestedTeam: 'Model Serving',
      explanation: 'Both simulated failures concern the model endpoint.',
      failedCases: [[suite: 'model-serving', name: 'deploys a model']]
    ]]
  ]
]

Map post(String path, Map payload, String baseUrl, String token) {
  HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection()
  connection.requestMethod = 'POST'
  connection.connectTimeout = 10000
  connection.readTimeout = 10000
  connection.doOutput = true
  connection.setRequestProperty('Content-Type', 'application/json')
  connection.setRequestProperty('Authorization', 'Bearer ' + token)
  try {
    connection.outputStream.withWriter('UTF-8') { writer ->
      writer.write(JsonOutput.toJson(payload))
    }
    int status = connection.responseCode
    String body = (status < 400 ? connection.inputStream : connection.errorStream)?.getText('UTF-8') ?: '{}'
    Map response = new JsonSlurper().parseText(body) as Map
    if (status != 200) throw new IllegalStateException("HTTP ${status} from ${path}: ${body}")
    return response
  } finally {
    connection.disconnect()
  }
}

String runPath = '/api/modules/releases/build-health/runs'
Map created = post(runPath, run, baseUrl, token)
assert created.status in ['created', 'updated']
assert created.version == version
println "Run upload: ${created.status} (${created.runKey})"

Map analyzed = post(runPath + '/analysis', analysis, baseUrl, token)
assert analyzed.status == 'updated'
assert analyzed.reviewStatus == 'unverified'
println "Agent analysis: ${analyzed.status} (${analyzed.reviewStatus})"

Map retried = post(runPath, run, baseUrl, token)
assert retried.status == 'updated'
assert retried.runKey == created.runKey
println "Run retry: ${retried.status} (${retried.runKey})"

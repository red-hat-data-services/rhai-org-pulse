<template>
  <div class="help-box tab-help-box">
    <h4>ℹ️ How to read {{ title }}</h4>
    <ul>
      <li><strong>Each column</strong> — One day. Cells show the latest run for that day; click the date to see every run, newest first.</li>
      <li><strong>Passed</strong> — Tests passed, the component was Ready in the DSC.</li>
      <li><strong>Failed</strong> — Tests failed, the component was not Ready in the DSC.</li>
      <li><strong>Blocked</strong> — Tests did not run: health checks failed first, or the component was not Ready in the DSC.</li>
      <li><strong>Blank</strong> — No result was reported for the component in that run.</li>
      <li><strong>Not Installed</strong> — The component is set to <code>Removed</code> in the DSC.</li>
      <li><strong>DSC &lt;name&gt;</strong> — The DataScienceCluster component the status came from (for example <code>trustyai</code> or <code>aigateway.batchGateway</code>).</li>
      <li>
        <strong>S3 artifacts</strong> — Log in via
        <a :href="S3_ACCESS_HELP.loginUrl" target="_blank" rel="noopener noreferrer">Red Hat IT AWS</a>,
        choose the account <code>{{ S3_ACCESS_HELP.account }}</code> and the role
        <template v-for="(role, idx) in S3_ACCESS_HELP.roles" :key="role"><template v-if="idx > 0"> or </template><code>{{ role }}</code></template>.
        No role yet? Request access in <code>{{ S3_ACCESS_HELP.requestChannel }}</code>.
        <strong>S3 access help</strong> next to "Runs on &lt;date&gt;" shows these steps too.
      </li>
    </ul>
  </div>
</template>

<script setup>
/** "How to read" legend shared by every nightly health matrix (Promotion Gate tab and Nightly Build Stability). */
import { S3_ACCESS_HELP } from '../composables/useNightlyHealthMatrix'

defineProps({
  /** Matrix name shown after "How to read" (e.g. "Promotion Gate Tests Results"). */
  title: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.help-box {
  background: var(--te-help-bg);
  border: 1px solid var(--te-help-border);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 6px;
}

.tab-help-box {
  margin-top: 0;
  margin-bottom: 16px;
  max-width: none;
}

.help-box h4 {
  font-size: 13px;
  color: var(--te-accent);
  margin-bottom: 6px;
  font-weight: normal;
}

.help-box li {
  font-size: 12px;
  color: var(--te-text-muted);
  line-height: 1.6;
  max-width: none;
}

.help-box ul {
  padding-left: 18px;
  margin-top: 4px;
}
</style>

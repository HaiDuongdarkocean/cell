# Observability — at-a-glance checklist

## Pre-launch instrumentation gate

Before shipping a feature, every item must be true:

- [ ] The on-call questions for this feature are written down, and each signal maps to one question
- [ ] All log output is structured (JSON), with stable event names and a correlation ID on every line
- [ ] No secrets, tokens, or unredacted PII in any log line (spot-check actual output)
- [ ] RED metrics exist for every new endpoint and every external dependency, with bounded label sets
- [ ] Latency is a histogram; p95/p99 are queryable
- [ ] A single request can be followed end-to-end in the tracing UI without broken spans
- [ ] Every new alert is symptom-based, has a runbook link, and was test-fired once
- [ ] An induced failure in staging was located via telemetry alone, without reading the source

## Quick sanity probes

- Can you answer "is it working right now?" from a dashboard in <30 seconds?
- Can you answer "what broke?" from an alert + runbook without opening the codebase?
- Does a fresh agent on-call know which dashboard to open first?

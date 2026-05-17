
# Design Decisions

- **Minimal educational sample** aligned with official Agents SDK style.
- **Agents SDK v1.5 focus:**
  - OpenTelemetry via preloaded `instrumentation.ts` modules (gRPC OTLP exporters; console fallback for local dev)
  - Proactive via `AgentApplication.proactive`
- **Mock worker** provides a true service boundary.
- **Explicit W3C trace context propagation** — each service calls `propagation.inject()` before outbound HTTP calls and `propagation.extract()` on inbound requests; no auto-instrumentation is used.
- **Two extra demo features**:
  - Failure scenario to show ERROR spans + exception recording
  - One histogram metric for processing latency

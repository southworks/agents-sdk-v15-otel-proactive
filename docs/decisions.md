
# Design Decisions

- **Minimal educational sample** aligned with official Agents SDK style.
- **Agents SDK v1.5 focus:**
  - OpenTelemetry via `@microsoft/agents-telemetry`
  - Proactive via `AgentApplication.proactive`
- **Mock worker** provides a true service boundary.
- **Automatic trace propagation** relies on OpenTelemetry instrumentation (no manual trace IDs).
- **Two extra demo features**:
  - Failure scenario to show ERROR spans + exception recording
  - One histogram metric for processing latency

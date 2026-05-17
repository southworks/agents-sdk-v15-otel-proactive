import { trace } from '@opentelemetry/api';

export class ApiTelemetry {
  public static tracer = trace.getTracer('agents-demo-api', '1.0.0');
}
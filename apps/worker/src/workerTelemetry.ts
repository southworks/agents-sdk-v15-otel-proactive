import { metrics, trace } from '@opentelemetry/api';

export class WorkerTelemetry {
  public static tracer = trace.getTracer('agents-demo-worker', '1.0.0');

  private static meter = metrics.getMeter('agents-demo-worker', '1.0.0');

  public static processingDuration = this.meter.createHistogram('demo.worker.processing.duration.ms', {
    description: 'Mock processing duration in milliseconds',
    unit: 'ms',
  });
}
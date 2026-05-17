import { metrics, trace } from '@opentelemetry/api';

export class BotTelemetry {
  public static tracer = trace.getTracer('agents-demo-bot', '1.0.0');

  private static meter = metrics.getMeter('agents-demo-bot', '1.0.0');

  public static uploadsCounter = this.meter.createCounter('demo.uploads.count', {
    unit: 'uploads',
    description: 'Number of uploads initiated via the bot',
  });
}
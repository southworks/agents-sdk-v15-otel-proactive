import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  PushMetricExporter,
} from '@opentelemetry/sdk-metrics';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LogRecordExporter,
} from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
let traceExporter: SpanExporter;
let metricExporter: PushMetricExporter;
let logExporter: LogRecordExporter;

if (otlpEndpoint.trim() !== '') {
  traceExporter = new OTLPTraceExporter();
  metricExporter = new OTLPMetricExporter();
  logExporter = new OTLPLogExporter();
} else {
  traceExporter = new ConsoleSpanExporter();
  metricExporter = new ConsoleMetricExporter();
  logExporter = new ConsoleLogRecordExporter();
}

const rawMetricsExportInterval = Number(process.env.OTEL_METRICS_EXPORT_INTERVAL);
const metricsExportInterval =
  Number.isFinite(rawMetricsExportInterval) && rawMetricsExportInterval > 0
    ? rawMetricsExportInterval
    : 5000;

const rawLogExportInterval = Number(process.env.OTEL_LOGS_EXPORT_INTERVAL);
const logExportInterval =
  Number.isFinite(rawLogExportInterval) && rawLogExportInterval > 0
    ? rawLogExportInterval
    : 5000;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'agents-demo-bot',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: metricsExportInterval,
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(logExporter, { scheduledDelayMillis: logExportInterval }),
  ],
});

sdk.start();

const shutdownHandler = () => {
  sdk
    .shutdown()
    .then(() => console.log('OTel SDK shut down successfully'))
    .catch((error) => {
      console.error('Error shutting down OTel SDK', error);
      process.exitCode = 1;
    });
};

process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);
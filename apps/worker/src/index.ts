
import express from 'express';
import { trace, SpanStatusCode, metrics } from '@opentelemetry/api';

import { initOtel } from './otel';

initOtel(process.env.OTEL_SERVICE_NAME ?? 'agents-demo-worker');

const tracer = trace.getTracer('agents-demo-worker');

// Custom metric: processing duration histogram
const meter = metrics.getMeter('agents-demo-worker');
const durationHistogram = meter.createHistogram('demo.worker.processing.duration.ms', {
  description: 'Mock processing duration in milliseconds',
  unit: 'ms',
});

const app = express();
app.use(express.json());

const failRate = Number(process.env.FAIL_RATE ?? '0.2');

app.post('/process', async (req, res) => {
  const { fileName, convId } = req.body ?? {};

  await tracer.startActiveSpan('worker.process_document', async (span) => {
    span.setAttribute('demo.file.name', fileName ?? '');
    span.setAttribute('demo.conversation.id', convId ?? '');

    const delayMs = 800 + Math.floor(Math.random() * 1200);
    await new Promise((r) => setTimeout(r, delayMs));

    const forceFail = typeof fileName === 'string' && fileName.toLowerCase().includes('fail');
    const shouldFail = forceFail || Math.random() < failRate;

    if (shouldFail) {
      const error = new Error('Mock processing failure');
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();

      // Record the metric even for failures
      durationHistogram.record(delayMs, { result: 'failure' });

      res.status(500).json({ error: error.message, delayMs });
      return;
    }

    const result = Math.random() > 0.5 ? 'success' : 'warning';
    span.setAttribute('demo.result', result);
    span.end();

    durationHistogram.record(delayMs, { result });

    res.json({ result, delayMs });
  });
});

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Worker listening on :${port} (FAIL_RATE=${failRate})`);
});

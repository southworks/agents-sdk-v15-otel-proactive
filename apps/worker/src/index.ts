
import express from 'express';
import { context, propagation, SpanStatusCode } from '@opentelemetry/api';

import { WorkerTelemetry } from './workerTelemetry';

const app = express();
app.use(express.json());

const failRate = Number(process.env.FAIL_RATE ?? '0.2');

app.post('/process', async (req, res) => {
  const { fileName, convId } = req.body ?? {};

  // Explicitly extract the W3C trace context from the incoming request so
  // this span becomes a child of the API's span in the distributed trace.
  const parentContext = propagation.extract(context.active(), req.headers);

  await WorkerTelemetry.tracer.startActiveSpan('worker.process_document', {}, parentContext, async (span) => {
    try {
      span.setAttribute('demo.file.name', fileName ?? '');
      span.setAttribute('demo.conversation.id', convId ?? '');

      const delayMs = 1000 + Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, delayMs));

      const forceFail = typeof fileName === 'string' && fileName.toLowerCase().includes('fail');
      const shouldFail = forceFail || Math.random() < failRate;

      if (shouldFail) {
        const error = new Error('Mock processing failure');
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        // Record the metric even for failures
        WorkerTelemetry.processingDuration.record(delayMs, { result: 'failure' });

        res.status(500).json({ error: error.message, delayMs });
        return;
      }

      const result = Math.random() > 0.5 ? 'success' : 'warning';
      span.setAttribute('demo.result', result);
      span.setStatus({ code: SpanStatusCode.OK });

      WorkerTelemetry.processingDuration.record(delayMs, { result });

      res.json({ result, delayMs });
    } finally {
      span.end();
    }
  });
});

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Worker listening on :${port} (FAIL_RATE=${failRate})`);
});


import express from 'express';
import axios from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { initOtel } from './otel';

initOtel(process.env.OTEL_SERVICE_NAME ?? 'agents-demo-api');

const tracer = trace.getTracer('agents-demo-api');

const app = express();
app.use(express.json());

const workerBaseUrl = process.env.WORKER_BASE_URL ?? 'http://localhost:3002';
const botNotifyUrl = process.env.BOT_NOTIFY_URL ?? 'http://localhost:3978/api/notify';

app.post('/upload', async (req, res) => {
  const { fileName, convId } = req.body ?? {};

  if (!convId) {
    res.status(400).json({ error: 'Missing convId' });
    return;
  }

  await tracer.startActiveSpan('api.upload_received', async (span) => {
    span.setAttribute('demo.file.name', fileName ?? '');
    span.setAttribute('demo.conversation.id', convId);

    let result: 'success' | 'warning' | 'failure' = 'success';
    let errorMessage: string | undefined;

    try {
      const workerResp = await axios.post(`${workerBaseUrl}/process`, { fileName, convId });
      result = workerResp.data?.result ?? 'success';
    } catch (err: any) {
      result = 'failure';
      errorMessage = err?.response?.data?.error ?? err?.message ?? 'worker call failed';
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
    }

    await axios.post(botNotifyUrl, { convId, result, fileName, errorMessage });

    span.end();
  });

  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});

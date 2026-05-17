
import express from 'express';
import axios from 'axios';
import { context, propagation, SpanStatusCode } from '@opentelemetry/api';

import { ApiTelemetry } from './apiTelemetry';

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

  // Explicitly extract the W3C trace context from the incoming request so
  // this span becomes a child of the bot's span.  Auto-instrumentation alone
  // is not reliable here because the express async wrapper can lose context.
  const parentContext = propagation.extract(context.active(), req.headers);

  try {
    await ApiTelemetry.tracer.startActiveSpan('api.upload_received', {}, parentContext, async (span) => {
      try {
        span.setAttribute('demo.file.name', fileName ?? '');
        span.setAttribute('demo.conversation.id', convId);

        // Inject the now-active api span so worker + bot/notify appear as its children.
        const traceHeaders: Record<string, string> = {};
        propagation.inject(context.active(), traceHeaders);

        let result: 'success' | 'warning' | 'failure' = 'success';
        let errorMessage: string | undefined;

        try {
          const workerResp = await axios.post(`${workerBaseUrl}/process`, { fileName, convId }, { headers: traceHeaders });
          result = workerResp.data?.result ?? 'success';
        } catch (err: any) {
          result = 'failure';
          errorMessage = err?.response?.data?.error ?? err?.message ?? 'worker call failed';
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        }

        try {
          await axios.post(botNotifyUrl, { convId, result, fileName, errorMessage }, { headers: traceHeaders });
        } catch (err: any) {
          const notifyErrorMessage = err?.response?.data?.error ?? err?.message ?? 'bot notify call failed';
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: notifyErrorMessage });
          // eslint-disable-next-line no-console
          console.error('[notify] Bot notify call failed:', notifyErrorMessage);
        }

        if (!res.headersSent) {
          res.json({ ok: true });
        }
      } finally {
        span.end();
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Upload handler failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Upload processing failed' });
    }
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});


import express from 'express';
import axios from 'axios';
import { context, propagation } from '@opentelemetry/api';
import {
  AgentApplication,
  CloudAdapter,
  MemoryStorage,
  TurnContext,
  TurnState,
  authorizeJWT,
  loadAuthConfigFromEnv,
} from '@microsoft/agents-hosting';
import { trace, SpanNames, metric } from '@microsoft/agents-telemetry';

import { initOtel } from './otel';

// Initialize OpenTelemetry BEFORE SDK usage.
initOtel(process.env.OTEL_SERVICE_NAME ?? 'agents-demo-bot');

type AppState = TurnState;

const authConfig = loadAuthConfigFromEnv();
const storage = new MemoryStorage();
const adapter = new CloudAdapter();

// The Playground connector runs on the host machine. Inside Docker,
// `localhost` resolves to the container itself, so override onTurnError to
// only log rather than attempting a second connector call that would fail
// with "Unknown error type: undefined" from the SDK.
adapter.onTurnError = async (_context, error) => {
  // eslint-disable-next-line no-console
  console.error('[onTurnError]', error);
};

const app = new AgentApplication<AppState>({ storage, adapter });

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';

// Custom metric: count uploads initiated
const uploadsCounter = metric.counter('demo.uploads.count');

app.onActivity('message', async (ctx: TurnContext) => {
  const text = (ctx.activity.text ?? '').trim();

  // Store conversation reference so proactive messaging works later.
  const convId = await app.proactive.storeConversation(ctx);

  if (!text.toLowerCase().startsWith('upload')) {
    await ctx.sendActivity('Send `upload <filename>` to start the demo.');
    await ctx.sendActivity(`(conversation stored, id: ${convId})`);
    return;
  }

  const fileName = text.split(/\s+/).slice(1).join(' ') || 'demo.pdf';

  // Record a metric that the operation started.
  uploadsCounter.add(1, { 'demo.command': 'upload' });

  await trace(
    {
      name: SpanNames.AGENTS_APP_ROUTE_HANDLER,
      record: { fileName, convId },
      end: ({ span, record }) => {
        span.setAttribute('demo.file.name', record.fileName);
        span.setAttribute('demo.conversation.id', record.convId);
      },
    },
    async () => {
      await ctx.sendActivity(`✅ Received: ${fileName}. Processing...`);

      // Capture the active span context so the API (and downstream worker)
      // can be stitched into the same distributed trace.
      const traceHeaders: Record<string, string> = {};
      propagation.inject(context.active(), traceHeaders);

      // Fire-and-forget: reply to the user immediately; proactive message
      // will arrive once the worker finishes (3-8 s later).
      void axios
        .post(`${apiBaseUrl}/upload`, { fileName, convId }, { headers: traceHeaders })
        .catch((err) => console.error('[upload] API call failed:', err?.message));

      await ctx.sendActivity('⏳ Processing started. You will get a proactive update soon.');
    }
  );
});

const server = express();
server.use(express.json({ limit: '2mb' }));

// Main agent endpoint used by Agents Playground.
// authorizeJWT validates the Bearer token and populates request.user with JWT
// claims; CloudAdapter.process() uses request.user as context.identity, which
// makes claims.aud available to app.proactive.storeConversation().
server.post('/api/messages', authorizeJWT(authConfig), async (req, res) => {
  try {
    // Docker host-gateway fix: Playground's connector runs on the host machine but
    // sends serviceUrl as http://localhost:PORT.  Inside Docker, localhost resolves
    // to the container itself (not the host), so POSTing back would fail with
    // ECONNREFUSED.  Rewrite to host.docker.internal before the adapter parses it.
    const body = req.body as { serviceUrl?: string };
    if (body?.serviceUrl?.includes('://localhost')) {
      body.serviceUrl = body.serviceUrl.replace('://localhost', '://host.docker.internal');
    }
    await adapter.process(req, res, async (context) => {
      await app.run(context);
    });
  } catch (error) {
    // Keep container alive for local troubleshooting when malformed traffic arrives.
    // eslint-disable-next-line no-console
    console.error('Failed to process incoming message activity', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process activity' });
    }
  }
});

// External trigger endpoint: API calls this when worker finishes.
// Bot then uses app.proactive.sendActivity(...) (v1.5 proactive model).
server.post('/api/notify', async (req, res) => {
  try {
    const { convId, result, fileName, errorMessage } = req.body ?? {};

    if (!convId) {
      res.status(400).json({ error: 'Missing convId' });
      return;
    }

    const text = result === 'failure'
      ? `❌ Processing FAILED for ${fileName ?? ''}: ${errorMessage ?? 'unknown error'}`
      : result === 'warning'
        ? `⚠️ Finished processing ${fileName ?? ''} with LOW CONFIDENCE (mock).`
        : `✅ Finished processing ${fileName ?? ''} successfully (mock).`;

    // Extract the W3C trace context forwarded by the API so the proactive
    // send span is attached to the same trace as the original bot turn.
    const parentContext = propagation.extract(context.active(), req.headers);

    await context.with(parentContext, async () => {
      await app.proactive.sendActivity(adapter, convId, {
        type: 'message',
        text,
      } as any);
    });

    res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send proactive notification', error);
    res.status(500).json({ error: 'Failed to send proactive notification' });
  }
});

const port = Number(process.env.PORT ?? 3978);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Bot listening on :${port} (messages: /api/messages, notify: /api/notify)`);
});

import { Logger } from './logger.js';

/**
 * OpenTelemetry tracing for distributed request tracking across proxy + MCP servers.
 * Enable with: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
 * Falls back gracefully if OpenTelemetry SDK is not installed.
 */
export async function initTracing(): Promise<void> {
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
    Logger.debug('[tracing] OpenTelemetry not configured (set OTEL_EXPORTER_OTLP_ENDPOINT)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-otlp-grpc');

    const exporter = new OTLPTraceExporter() as any;
    const instruments = getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-pino': { enabled: false },
    }) as any;

    const sdk = new NodeSDK({
      traceExporter: exporter,
      instrumentations: [instruments],
    });

    await sdk.start();
    Logger.info('[tracing] OpenTelemetry tracing initialized — exporting to OTLP endpoint');
  } catch (err: any) {
    Logger.warn(`[tracing] OpenTelemetry initialization failed: ${err?.message}`);
  }
}
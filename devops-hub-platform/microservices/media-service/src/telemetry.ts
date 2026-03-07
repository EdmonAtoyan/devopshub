import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

export async function startTelemetry(serviceName: string): Promise<void> {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const exporter = new OTLPMetricExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: Number(process.env.OTEL_METRICS_EXPORT_INTERVAL ?? 10000),
  });

  const sdk = new NodeSDK({
    serviceName,
    metricReader: metricReader as any,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();
}

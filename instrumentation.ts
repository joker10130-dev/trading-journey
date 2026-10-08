export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    ?? (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/metrics`
      : undefined);
  if (!endpoint) return;

  const [{ OTLPMetricExporter }, { PeriodicExportingMetricReader }, { NodeSDK }] = await Promise.all([
    import("@opentelemetry/exporter-metrics-otlp-http"),
    import("@opentelemetry/sdk-metrics"),
    import("@opentelemetry/sdk-node"),
  ]);
  const sdk = new NodeSDK({
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
      exportIntervalMillis: 15_000,
    }),
  });
  sdk.start();
}

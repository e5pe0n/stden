import { z } from "zod";

const envSchema = z.object({
  OTEL_SERVICE_NAME: z.string(),
  // OTEL_METRICS_EXPORTER: z.string(),
  OTEL_METRICS_EXPORTER_PORT: z.coerce.number(),
  // OTEL_TRACES_EXPORTER: z.string(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
});

const res = envSchema.safeParse(process.env);
if (!res.success) {
  console.error("Invalid environment variables:", res.error.format());
  throw new Error("Invalid environment variables", { cause: res.error });
}

export const telemetryConfig: {
  otelServiceName: string;
  // otelMetricsExporter: string;
  otelMetricsExporterPort: number;
  // otelTracesExporter: string;
  otelExporterOtlpEndpoint: string;
} = {
  otelServiceName: res.data.OTEL_SERVICE_NAME,
  // otelMetricsExporter: res.data.OTEL_METRICS_EXPORTER,
  otelMetricsExporterPort: res.data.OTEL_METRICS_EXPORTER_PORT,
  // otelTracesExporter: res.data.OTEL_TRACES_EXPORTER,
  otelExporterOtlpEndpoint: res.data.OTEL_EXPORTER_OTLP_ENDPOINT,
};

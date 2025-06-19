import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  detectResources,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger } from "@opentelemetry/api";
import { telemetryConfig } from "./configs/telemetry.js";

diag.setLogger(new DiagConsoleLogger());

const metricsExporter = new PrometheusExporter(
  {
    port: telemetryConfig.otelMetricsExporterPort,
  },
  (err) => {
    if (err) {
      diag.error("Error initializing Prometheus metrics exporter", err);
      return;
    }
    diag.info(
      `Prometheus metrics available at port ${telemetryConfig.otelMetricsExporterPort}`,
    );
  },
);

const traceExporter = new OTLPTraceExporter({
  url: telemetryConfig.otelExporterOtlpEndpoint,
});

const detected = detectResources();

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: telemetryConfig.otelServiceName,
  [ATTR_SERVICE_VERSION]: "1.0.0",
}).merge(detected);

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: metricsExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  diag.info("OpenTelemetry automatic instrumentation started successfully");
} catch (error) {
  diag.error(
    "Error initializing OpenTelemetry SDK. Your application is not instrumented and will not produce telemetry",
    error,
  );
}

// Gracefully shut down the SDK to flush telemetry when the program exits
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => diag.debug("OpenTelemetry SDK terminated"))
    .catch((error) => diag.error("Error terminating OpenTelemetry SDK", error));
});

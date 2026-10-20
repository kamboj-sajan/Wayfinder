import Fastify from "fastify";
import { dbRoutes } from "./routes/db.routes.js";
import { visionRoutes } from "./routes/vision.routes.js";
import { monitorRoutes } from "./routes/monitor.routes.js";
import { graphRoutes } from "./routes/graph.routes.js";

const app = Fastify({ logger: true });

// Comma-separated dashboard origins allowed to call the API. Unset allows any
// origin, which is only meant for local development.
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  console.warn("⚠️ CORS_ORIGINS is not set - accepting requests from any origin.");
}

// Enable CORS for frontend integration
app.register(import('@fastify/cors'), {
  origin: corsOrigins.length > 0 ? corsOrigins : true
});

app.register(dbRoutes, { prefix: "/db" });
app.register(visionRoutes, { prefix: "/vision" });
app.register(monitorRoutes, { prefix: "/monitor" });
app.register(graphRoutes, { prefix: "/graph" });

// Test route
app.get("/test", async () => {
  return { message: "Server is working" };
});

const start = async () => {
  try {
    // App Service and Container Apps supply the port through PORT.
    const port = Number(process.env.PORT) || 5050;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Azure Integration Server running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

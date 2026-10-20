import { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../utils/auth.js";
import { getGraph, listRuns, deleteRun } from "../services/graph.services.js";
import { readScreenshot, saveScreenshot } from "../utils/screenshots.js";

export async function graphRoutes(app: FastifyInstance) {

  // -------------------------
  // PUBLIC: SERVE SCREENSHOTS
  // -------------------------
  app.get("/screenshots/:filename", async (req: any, reply) => {
    try {
      const { filename } = req.params;
      const screenshot = await readScreenshot(filename);

      if (!screenshot) {
        reply.code(404);
        return { error: "Screenshot not found" };
      }

      reply.type("image/png");
      return reply.send(screenshot);
    } catch (err) {
      reply.code(500);
      return { error: "Failed to serve screenshot" };
    }
  });

  // -------------------------
  // PROTECTED ROUTES
  // -------------------------
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", apiKeyAuth);

    // Screenshots arrive as raw PNG bodies, larger than the default 1 MB limit.
    protectedApp.addContentTypeParser(
      "image/png",
      { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 },
      (_req, body, done) => done(null, body)
    );

    // UPLOAD SCREENSHOT
    protectedApp.put("/screenshots/:filename", async (req: any, reply) => {
      try {
        if (!Buffer.isBuffer(req.body)) {
          reply.code(415);
          return { error: "Expected an image/png body" };
        }

        if (!(await saveScreenshot(req.params.filename, req.body))) {
          reply.code(400);
          return { error: "Invalid screenshot name" };
        }

        return { message: "Screenshot stored" };
      } catch (err) {
        reply.code(500);
        return { error: "Failed to store screenshot" };
      }
    });

    // FETCH GRAPH
    protectedApp.get("/run/:runId", async (req: any) => {
      const { runId } = req.params;
      return getGraph(runId);
    });

    // LIST RUNS
    protectedApp.get("/runs", async (req, reply) => {
      try {
        return await listRuns();
      } catch (err) {
        reply.code(500);
        return { error: "Failed to list runs" };
      }
    });

    // DELETE RUN
    protectedApp.delete("/run/:runId", async (req: any, reply) => {
      try {
        const { runId } = req.params;
        await deleteRun(runId);
        return { message: "Run deleted successfully" };
      } catch (err) {
        reply.code(500);
        return { error: "Failed to delete run" };
      }
    });
  });
}

import fs from "fs";
import path from "path";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

/**
 * Root directory that screenshots are served from. Configurable so the server
 * does not depend on being started from a specific working directory.
 */
export const SCREENSHOT_ROOT = path.resolve(
  process.env.WAYFINDER_SCREENSHOT_DIR || path.join(process.cwd(), "..", "screenshots")
);

/**
 * Reduce a client-supplied screenshot name to a bare filename. Returns null for
 * anything that is not a plain name once directories are stripped.
 */
export function screenshotName(requested: string): string | null {
  if (!requested || typeof requested !== "string") return null;

  const filename = path.basename(requested);

  if (!filename || filename === "." || filename === "..") return null;

  return filename;
}

/**
 * Resolve a client-supplied screenshot name to an absolute path inside
 * SCREENSHOT_ROOT. Returns null if the name escapes the root or does not exist.
 *
 * Both the basename strip and the containment check are needed: basename alone
 * is easy to regress, and the prefix check alone would accept a symlinked path.
 */
export function resolveScreenshotPath(requested: string): string | null {
  const filename = screenshotName(requested);
  if (!filename) return null;

  const fullPath = path.resolve(SCREENSHOT_ROOT, filename);

  // Ensure the resolved path is still inside the screenshot root.
  const relative = path.relative(SCREENSHOT_ROOT, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;

  return fullPath;
}

// -------------------------
// STORAGE BACKEND
// -------------------------
// With AZURE_STORAGE_CONNECTION_STRING set, screenshots live in a private blob
// container so the agent and the backend no longer need to share a disk.
// Without it they are read from and written to SCREENSHOT_ROOT.

let containerPromise: Promise<ContainerClient> | null = null;

function blobContainer(): Promise<ContainerClient> | null {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return null;

  if (!containerPromise) {
    const container = BlobServiceClient
      .fromConnectionString(connectionString)
      .getContainerClient(process.env.AZURE_STORAGE_CONTAINER || "screenshots");

    containerPromise = container.createIfNotExists().then(() => container);
    // Let a failed create be retried on the next request.
    containerPromise.catch(() => { containerPromise = null; });
  }

  return containerPromise;
}

/** Store a screenshot under a bare filename. Returns false for an invalid name. */
export async function saveScreenshot(requested: string, data: Buffer): Promise<boolean> {
  const filename = screenshotName(requested);
  if (!filename || !/^[\w.-]+\.png$/i.test(filename)) return false;

  const container = await blobContainer();
  if (container) {
    await container.getBlockBlobClient(filename).uploadData(data, {
      blobHTTPHeaders: { blobContentType: "image/png" }
    });
    return true;
  }

  fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_ROOT, filename), data);
  return true;
}

/** Read a screenshot by name. Returns null if it is invalid or missing. */
export async function readScreenshot(requested: string): Promise<Buffer | null> {
  const container = await blobContainer();
  if (container) {
    const filename = screenshotName(requested);
    if (!filename) return null;

    const blob = container.getBlockBlobClient(filename);
    if (!(await blob.exists())) return null;
    return blob.downloadToBuffer();
  }

  const fullPath = resolveScreenshotPath(requested);
  return fullPath ? fs.readFileSync(fullPath) : null;
}

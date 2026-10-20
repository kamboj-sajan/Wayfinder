import fs from "fs";
import path from "path";

/**
 * Loads all ObservationContract files from a run folder
 * and returns them as a chronological trace.
 */
export function loadObservationRun(runFolderPath: string) {
  const folder = path.resolve(runFolderPath);

  if (!fs.existsSync(folder)) {
    throw new Error(`Run folder not found: ${folder}`);
  }

  const files = fs
    .readdirSync(folder)
    .filter(f => f.endsWith(".json"))
    .sort(); // filename order = action order

  const observations = files.map(file => {
    const fullPath = path.join(folder, file);
    const raw = fs.readFileSync(fullPath, "utf-8");

    return {
      file,
      path: fullPath,
      data: JSON.parse(raw)
    };
  });

  return {
    run_folder: folder,
    steps: observations
  };
}

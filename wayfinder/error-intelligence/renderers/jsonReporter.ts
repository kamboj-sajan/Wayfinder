import fs from "fs";
import path from "path";

export function writeJsonReport(outPath: string, report: any) {
  const full = path.resolve(outPath);
  fs.writeFileSync(full, JSON.stringify(report, null, 2));
  console.log(`JSON report written → ${full}`);
}

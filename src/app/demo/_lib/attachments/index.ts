import { easyUnivFiles } from "./easy-univ";
import { junctionFiles } from "./junction";
import type { DemoFile } from "./types";
import { youthHousingFiles } from "./youth-housing";

export type { DemoFile, DemoFileFormat } from "./types";

/** slug → 첨부 목록. 없는 사이트는 첨부가 없다 */
export const demoFiles: Record<string, DemoFile[]> = {
  "youth-housing": youthHousingFiles,
  "junction-apply": junctionFiles,
  "easy-univ": easyUnivFiles,
};

export function filesFor(slug: string): DemoFile[] {
  return demoFiles[slug] ?? [];
}

export function findFile(slug: string, name: string): DemoFile | undefined {
  return filesFor(slug).find((f) => f.name === name);
}

export { fileHref } from "../file-href";

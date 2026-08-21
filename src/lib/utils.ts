import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 파싱된 문서 요소들의 평균 신뢰도를 계산한다. */
export function averageConfidence(scores: number[]): number {
  return scores.reduce((sum, score) => sum + score) / scores.length;
}

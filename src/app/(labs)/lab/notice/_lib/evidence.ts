/**
 * 근거 하이라이트는 `src/lib/grounding.ts` 로 승격했다.
 *
 * 프로덕션(`app/start`)이 읽어야 하는데 실험 폴더에 있으면 그 폴더를 지울 때
 * 프로덕션이 같이 깨진다. 여기는 기존 import 를 위한 통로만 남긴다.
 */
export {
  citedEvidence,
  matchEvidence,
  pageCount,
  toCitations,
  toEvidence,
  type Box,
  type Evidence,
  type Match,
} from "@/lib/grounding";

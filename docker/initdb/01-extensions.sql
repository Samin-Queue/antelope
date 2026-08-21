-- 새 볼륨으로 DB 를 만들 때 한 번 실행된다.
-- pgvector 가 없으면 drizzle 의 vector 컬럼이 42704(type "vector" does not exist)로 깨진다.
-- 프로덕션(Railway)에도 같은 확장이 활성화되어 있다.
CREATE EXTENSION IF NOT EXISTS vector;

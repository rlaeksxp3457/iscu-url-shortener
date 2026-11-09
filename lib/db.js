import { neon, neonConfig } from "@neondatabase/serverless";

// 로컬 테스트 전용: NEON_LOCAL_PROXY=1이면 Docker의 로컬 Neon HTTP 프록시로 접속합니다.
// Vercel 배포 환경에는 이 변수가 없으므로 실제 Neon DB에 그대로 접속합니다.
if (process.env.NEON_LOCAL_PROXY === "1") {
  neonConfig.fetchEndpoint = (host) =>
    host === "db.localtest.me" ? `http://${host}:4444/sql` : `https://${host}/sql`;
}

// DATABASE_URL이 없을 때 빌드 단계에서 바로 실패하지 않도록, 처음 사용할 때 연결 객체를 만듭니다.
let sqlClient = null;

function getSql() {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
    }
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

// 4주차 urls 테이블과 6주차 클릭 기록 컬럼을 준비합니다.
// 함수 인스턴스마다 처음 한 번만 실행되며, 이미 있으면 아무것도 바꾸지 않습니다.
let schemaReady = null;

export function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS urls (
          short_code VARCHAR(6) PRIMARY KEY,
          original_url TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        ALTER TABLE urls
        ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ
      `;
      // 같은 originalUrl을 빠르게 찾기 위한 인덱스 (동일 URL 중복 처리)
      await sql`
        CREATE INDEX IF NOT EXISTS urls_original_url_idx ON urls (original_url)
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function saveUrl(shortCode, originalUrl) {
  await ensureSchema();
  const sql = getSql();
  // 이미 같은 shortCode가 있으면 저장하지 않고, 저장 여부를 돌려줍니다.
  const rows = await sql`
    INSERT INTO urls (short_code, original_url)
    VALUES (${shortCode}, ${originalUrl})
    ON CONFLICT (short_code) DO NOTHING
    RETURNING short_code
  `;
  return rows.length > 0;
}

// 5주차: shortCode로 원본 URL 찾기 (없으면 null)
export async function findUrlByShortCode(shortCode) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;
  return rows[0]?.original_url ?? null;
}

// 종합 과제: 이미 단축한 originalUrl이면 기존 shortCode 찾기 (없으면 null)
export async function findShortCodeByOriginalUrl(originalUrl) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT short_code
    FROM urls
    WHERE original_url = ${originalUrl}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0]?.short_code ?? null;
}

export { getSql };

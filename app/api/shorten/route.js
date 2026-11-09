import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  findShortCodeByOriginalUrl,
  findUrlByShortCode,
  saveUrl,
} from "../../../lib/db";

export const runtime = "nodejs";

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256")
    .update(originalUrl)
    .digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16
    );

    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

function errorResponse(status, code, message) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/*
 * getServiceHosts()
 *
 * 지금 요청을 받은 이 서비스의 주소(호스트) 목록입니다.
 * 요청 Host 헤더와 Vercel이 넣어 주는 배포 주소를 함께 사용합니다.
 */
function getServiceHosts(request) {
  const hosts = new Set();
  const add = (value) => {
    if (value) {
      hosts.add(value.split(",")[0].trim().toLowerCase());
    }
  };

  add(request.headers.get("x-forwarded-host"));
  add(request.headers.get("host"));
  add(new URL(request.url).host);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);

  return hosts;
}

/*
 * isOwnServiceUrl()
 *
 * 종합 과제: 자기 서비스 URL 단축 방지
 * 경로나 http/https 여부와 관계없이, 호스트가 이 서비스와 같으면 true입니다.
 */
function isOwnServiceUrl(parsedUrl, request) {
  const serviceHosts = getServiceHosts(request);
  const targetHost = parsedUrl.host.toLowerCase();
  const targetHostname = parsedUrl.hostname.toLowerCase();

  for (const host of serviceHosts) {
    const hostname = host.replace(/:\d+$/, "");
    if (host === targetHost || hostname === targetHostname) {
      return true;
    }
  }
  return false;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {
    // 1. 요청 body 읽기
    const body = await request.json().catch(() => null);

    const raw = body?.originalUrl;
    const originalUrl =
      typeof raw === "string" ? raw.trim() : "";

    // 2. URL이 입력되지 않은 경우 → 400
    if (!originalUrl) {
      return errorResponse(400, "MISSING_URL", "Original URL is required.");
    }

    // 3. URL이 너무 긴 경우 → 400
    if (originalUrl.length > MAX_URL_LENGTH) {
      return errorResponse(
        400,
        "URL_TOO_LONG",
        `URL must be ${MAX_URL_LENGTH} characters or fewer.`
      );
    }

    // 4. URL 형식 검사 → 400
    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return errorResponse(400, "INVALID_URL", "URL must start with http:// or https://.");
    }

    // 5. 프로토콜 검사: http 또는 https만 허용 → 400
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return errorResponse(400, "INVALID_URL", "URL must start with http:// or https://.");
    }

    // 6. 종합 과제: 자기 서비스 URL 단축 방지 → 400
    if (isOwnServiceUrl(parsedUrl, request)) {
      return errorResponse(
        400,
        "SELF_URL",
        "This service's own URL cannot be shortened."
      );
    }

    const baseUrl = new URL(request.url).origin;

    // 7. 종합 과제: 동일 URL 중복 처리 → 기존 shortCode 반환 (200)
    const existingCode = await findShortCodeByOriginalUrl(originalUrl);

    if (existingCode) {
      return NextResponse.json(
        {
          shortCode: existingCode,
          shortUrl: `${baseUrl}/${existingCode}`,
          originalUrl,
        },
        { status: 200 }
      );
    }

    // 8. 새 shortCode 생성 후 저장 → 201
    //    (해시가 다른 URL과 겹치면 뒤에 번호를 붙여 다시 만들어 봅니다)
    for (let attempt = 0; attempt < 5; attempt++) {
      const source = attempt === 0 ? originalUrl : `${originalUrl}#${attempt}`;
      const shortCode = createShortCode(source);
      const saved = await saveUrl(shortCode, originalUrl);

      if (saved || (await findUrlByShortCode(shortCode)) === originalUrl) {
        return NextResponse.json(
          {
            shortCode,
            shortUrl: `${baseUrl}/${shortCode}`,
            originalUrl,
          },
          { status: saved ? 201 : 200 }
        );
      }
    }

    return errorResponse(500, "INTERNAL_ERROR", "Failed to create short URL.");
  } catch (error) {
    // 9. 서버 내부 오류 → 500
    console.error("Failed to create short URL", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to create short URL.");
  }
}

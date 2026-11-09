import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFoundResponse() {
  return Response.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Short URL not found.",
      },
    },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(request, { params }) {
  const { shortCode } = await params;

  // shortCode 형식이 아니면 DB를 조회하지 않고 404
  if (!/^[A-Za-z0-9]{6}$/.test(shortCode)) {
    return notFoundResponse();
  }

  const originalUrl = await findUrlByShortCode(shortCode);

  // originalUrl이 존재하지 않는 경우 404 Not Found
  if (!originalUrl) {
    return notFoundResponse();
  }

  // 6주차: 클릭 기록. 기록에 실패해도 사용자 이동(Redirect)은 계속합니다.
  try {
    await recordClick(shortCode);
  } catch (error) {
    console.error("Failed to record click", error);
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}

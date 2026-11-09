"use client";

import { useState } from "react";

const MAX_URL_LENGTH = 2048;

function validateUrl(value) {
  const trimmedUrl = value.trim();

  // 1. 빈 값 검증
  if (!trimmedUrl) {
    return "URL을 입력해 주세요.";
  }

  // 2. 최대 길이 검증
  if (trimmedUrl.length > MAX_URL_LENGTH) {
    return `URL은 ${MAX_URL_LENGTH}자 이하로 입력해 주세요.`;
  }

  // 3. http:// 또는 https:// 시작 여부 검증
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return "URL은 http:// 또는 https://로 시작해야 합니다.";
  }

  // 4. 올바른 URL 형식 검증
  try {
    new URL(trimmedUrl);
  } catch {
    return "올바른 URL 형식이 아닙니다.";
  }

  return null;
}

// 서버 오류 코드를 사용자에게 보여 줄 문장으로 바꿉니다.
const ERROR_MESSAGES = {
  MISSING_URL: "URL을 입력해 주세요.",
  URL_TOO_LONG: `URL은 ${MAX_URL_LENGTH}자 이하로 입력해 주세요.`,
  INVALID_URL: "URL은 http:// 또는 https://로 시작하는 올바른 주소여야 합니다.",
  SELF_URL: "이 서비스의 주소는 다시 단축할 수 없습니다.",
  INTERNAL_ERROR: "서버 오류로 단축 URL을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default function Home() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleChange(event) {
    setOriginalUrl(event.target.value);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setResult(null);
    setCopied(false);

    const validationError = validateUrl(originalUrl);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalUrl: originalUrl.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = data?.error?.code;
        setError(ERROR_MESSAGES[code] ?? "단축 URL을 만들지 못했습니다.");
        return;
      }

      // 201: 새로 만든 URL, 200: 이미 단축한 URL(기존 shortCode 반환)
      setResult({ ...data, isExisting: response.status === 200 });
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="url-card" aria-labelledby="page-title">
        <div className="week-label">CLOUD COMPUTING</div>

        <div className="intro">
          <h1 id="page-title">URL Shortener</h1>
          <p>
            긴 URL을 입력하면 6자리 짧은 주소로 바꿔 드립니다.
          </p>
        </div>

        <form className="url-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="original-url">줄이고 싶은 URL</label>
          <div className="input-row">
            <input
              id="original-url"
              name="originalUrl"
              type="text"
              inputMode="url"
              placeholder="https://example.com/very-long-url"
              value={originalUrl}
              onChange={handleChange}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "url-error" : undefined}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Shortening..." : "Shorten"}
            </button>
          </div>

          <div className="message-area" aria-live="polite">
            {error && (
              <p id="url-error" className="message message-error" role="alert">
                {error}
              </p>
            )}

            {isLoading && (
              <p className="message message-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                짧은 URL을 만들고 있습니다.
              </p>
            )}

            {result && (
              <div className="message message-success" role="status">
                <p>
                  {result.isExisting
                    ? "이미 단축한 URL이라 기존 짧은 주소를 알려 드려요."
                    : "짧은 URL을 만들었습니다."}
                </p>
                <p>
                  <a href={result.shortUrl} target="_blank" rel="noreferrer">
                    {result.shortUrl}
                  </a>{" "}
                  <button type="button" onClick={handleCopy}>
                    {copied ? "복사됨" : "복사"}
                  </button>
                </p>
              </div>
            )}
          </div>
        </form>

        <aside className="practice-note">
          <span aria-hidden="true">✓</span>
          <p>
            같은 URL은 같은 짧은 주소로 안내하며, 이 서비스 자신의 주소는
            단축할 수 없습니다.
          </p>
        </aside>
      </section>
    </main>
  );
}

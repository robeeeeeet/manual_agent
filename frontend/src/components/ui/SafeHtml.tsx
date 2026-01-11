"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

/**
 * 許可するHTMLタグのリスト
 * メンテナンス説明文で使用される構造化タグのみを許可
 */
const ALLOWED_TAGS = [
  "h4",
  "h5",
  "ol",
  "ul",
  "li",
  "p",
  "strong",
  "em",
  "br",
];

/**
 * 許可する属性（基本的に属性は不要だが、将来の拡張性のため）
 */
const ALLOWED_ATTR: string[] = [];

interface SafeHtmlProps {
  /** 表示するHTML文字列 */
  html: string;
  /** 追加のCSSクラス */
  className?: string;
}

/**
 * XSS対策済みのHTML表示コンポーネント
 *
 * DOMPurifyでサニタイズし、許可されたタグのみを表示する。
 * Tailwind Typographyの`prose`クラスで一貫したスタイリングを適用。
 */
export function SafeHtml({ html, className = "" }: SafeHtmlProps) {
  const sanitizedHtml = useMemo(() => {
    // プレーンテキストの場合はそのまま返す（後方互換性）
    if (!html) return "";

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });
  }, [html]);

  return (
    <div
      className={`prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-ol:my-2 prose-ul:my-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

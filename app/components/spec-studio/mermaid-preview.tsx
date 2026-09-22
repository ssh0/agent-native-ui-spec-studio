import { useEffect, useId, useRef, useState } from "react";
export function MermaidFlowPreview({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const renderNumber = useRef(0);
  const instance = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const trimmedSource = source.trim();
    renderNumber.current += 1;
    const currentRender = renderNumber.current;

    if (!trimmedSource) {
      setSvg("");
      setHasError(false);
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setHasError(false);
    const debounce = window.setTimeout(() => {
      void import("mermaid")
        .then(({ default: mermaid }) => {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables: {
              fontFamily: "Inter Variable, Noto Sans JP, sans-serif",
              primaryColor: "#e8f6f5",
              primaryTextColor: "#172126",
              primaryBorderColor: "#087f8c",
              lineColor: "#617079",
              secondaryColor: "#f4f7f7",
              tertiaryColor: "#ffffff",
            },
          });
          return mermaid.render(
            `spec-flow-${instance}-${currentRender}`,
            trimmedSource,
          );
        })
        .then(({ svg: renderedSvg }) => {
          if (cancelled || currentRender !== renderNumber.current) return;
          setSvg(renderedSvg);
          setHasError(false);
        })
        .catch(() => {
          if (cancelled || currentRender !== renderNumber.current) return;
          setSvg("");
          setHasError(true);
        })
        .finally(() => {
          if (!cancelled && currentRender === renderNumber.current)
            setIsRendering(false);
        });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [source, instance]);

  if (!source.trim())
    return (
      <div className="spec-flow-empty">
        この段階のフローはまだ定義されていません。
      </div>
    );
  if (hasError)
    return (
      <div className="spec-flow-fallback" role="alert">
        <p>Mermaidの構文を確認してください。ソースを表示しています。</p>
        <pre className="spec-flow-code">{source}</pre>
      </div>
    );
  return (
    <div
      className={`spec-flow-render ${isRendering ? "is-rendering" : ""}`}
      aria-busy={isRendering}
    >
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="spec-flow-loading">
          {isRendering ? "描画中…" : "図を表示できません。"}
        </div>
      )}
    </div>
  );
}

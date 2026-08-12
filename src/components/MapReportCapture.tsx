import React, { useEffect, useRef, useState, ReactNode, forwardRef, useImperativeHandle } from 'react';
import html2canvas from 'html2canvas';

export interface MapReportCaptureRef {
  capture: () => Promise<string | null>;
}

interface MapReportCaptureProps {
  id?: string;
  className?: string;
  children: ReactNode;
  onCapture?: (dataUrl: string) => void;
  autoCapture?: boolean;
  triggerKey?: any;
}

export const MapReportCapture = forwardRef<MapReportCaptureRef, MapReportCaptureProps>(({
  id = 'gis-map-container',
  className = 'border-2 border-slate-900 rounded-xl overflow-hidden bg-slate-100 shadow-inner relative',
  children,
  onCapture,
  autoCapture = true,
  triggerKey,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const captureMap = async () => {
    if (!containerRef.current) return null;
    try {
      const canvas = await html2canvas(containerRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false,
        backgroundColor: '#f8fafc',
        onclone: (clonedDoc) => {
          const colorRegex = /(oklch|oklab|lab|lch)\s*\([^)]+\)/gi;
          
          // 1. Recursively sanitize stylesheet rules (including media/supports grouping rules)
          const sanitizeRules = (rules: CSSRuleList) => {
            if (!rules) return;
            for (let i = rules.length - 1; i >= 0; i--) {
              const rule = rules[i];
              try {
                if (rule.cssText && colorRegex.test(rule.cssText)) {
                  if ('style' in rule && (rule as CSSStyleRule).style) {
                    const style = (rule as CSSStyleRule).style;
                    for (let j = style.length - 1; j >= 0; j--) {
                      const prop = style[j];
                      const val = style.getPropertyValue(prop);
                      if (val && colorRegex.test(val)) {
                        style.setProperty(prop, '#0f172a');
                      }
                    }
                  } else if ('cssRules' in rule && (rule as any).cssRules) {
                    sanitizeRules((rule as any).cssRules);
                  }
                }
              } catch {}
            }
          };

          try {
            const stylesheets = Array.from(clonedDoc.styleSheets);
            stylesheets.forEach((sheet) => {
              try {
                if (sheet.cssRules) {
                  sanitizeRules(sheet.cssRules);
                }
              } catch {}
            });
          } catch {}

          // 2. Replace unsupported colors in style elements textContent
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((style) => {
            if (style.textContent && colorRegex.test(style.textContent)) {
              style.textContent = style.textContent.replace(colorRegex, '#0f172a');
            }
          });

          // 3. Replace unsupported colors in inline style attributes
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const styleAttr = el.getAttribute('style');
            if (styleAttr && colorRegex.test(styleAttr)) {
              el.setAttribute('style', styleAttr.replace(colorRegex, '#0f172a'));
            }
          });
        },
      });

      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      if (onCapture) {
        onCapture(dataUrl);
      }
      return dataUrl;
    } catch (error) {
      console.error('Error capturing map report:', error);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    capture: captureMap,
  }));

  useEffect(() => {
    if (autoCapture) {
      const timer = setTimeout(() => {
        captureMap();
      }, 1000); // Wait for tiles and markers to render
      return () => clearTimeout(timer);
    }
  }, [triggerKey, autoCapture]);

  return (
    <div ref={containerRef} id={id} className={className}>
      {children}
    </div>
  );
});

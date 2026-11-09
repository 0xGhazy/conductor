import React, { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { Home } from "lucide-react";
import styles from "./NotFoundPage.module.css";

const ENTITY_NOT_FOUND_CONTEXT_KEY = "entity_not_found_context";

const readContext = () => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ENTITY_NOT_FOUND_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface NotFoundContext {
  message?: string;
  reason?: string;
  requestId?: string;
  timestamp?: string;
  path?: string;
}

interface NotFoundPageProps {
  context?: NotFoundContext | null;
}

export default function NotFoundPage({ context: contextOverride = null }: NotFoundPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const context = useMemo(
    () => contextOverride || (location?.state as NotFoundContext) || readContext(),
    [contextOverride, location?.state]
  );

  useEffect(() => {
    document.title = "404 - Not Found";
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ENTITY_NOT_FOUND_CONTEXT_KEY);
    }
  }, []);

  // Keyboard shortcut: H -> Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const message = String(context?.message || "The requested route, workflow, or entity was not found.");

  return (
    <div className={styles.container}>
      <div className={styles.canvasGrid} aria-hidden="true" />

      <main className={styles.card}>
        <div className={styles.heroSection}>
          {/* Orchestration Pipeline SVG Graphic */}
          <div className={styles.diagramWrapper} aria-hidden="true">
            <svg
              className={styles.diagramSvg}
              viewBox="0 0 520 86"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Connection Line */}
              <line
                x1="120"
                y1="43"
                x2="220"
                y2="43"
                stroke="var(--color-border-strong)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <line
                x1="300"
                y1="43"
                x2="400"
                y2="43"
                stroke="var(--color-accent-solid)"
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.6"
              />

              {/* Source Request Node */}
              <rect
                x="12"
                y="18"
                width="108"
                height="50"
                rx="8"
                fill="var(--color-canvas-default)"
                stroke="var(--color-border-default)"
                strokeWidth="1.5"
              />
              <circle cx="30" cy="43" r="5" fill="var(--hue-blue)" />
              <text
                x="44"
                y="39"
                fill="var(--color-fg-default)"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                REQUEST
              </text>
              <text
                x="44"
                y="54"
                fill="var(--color-fg-subtle)"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
              >
                HTTP / GET
              </text>

              {/* Center 404 Warning Node */}
              <g transform="translate(220, 11)">
                <rect
                  x="0"
                  y="0"
                  width="80"
                  height="64"
                  rx="10"
                  fill="var(--color-canvas-default)"
                  stroke="var(--color-accent-solid)"
                  strokeWidth="2"
                  filter="drop-shadow(0 4px 12px color-mix(in srgb, var(--color-accent-solid) 20%, transparent))"
                />
                <circle
                  cx="40"
                  cy="24"
                  r="12"
                  fill="color-mix(in srgb, var(--color-accent-solid) 14%, transparent)"
                />
                <path
                  d="M40 18V25M40 28.5V29.5"
                  stroke="var(--color-accent-solid)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <text
                  x="40"
                  y="51"
                  fill="var(--color-accent-solid)"
                  fontSize="12.5"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  404
                </text>
              </g>

              {/* Destination Missing Node */}
              <rect
                x="400"
                y="18"
                width="108"
                height="50"
                rx="8"
                fill="var(--color-canvas-subtle)"
                stroke="var(--color-border-default)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle cx="418" cy="43" r="5" fill="var(--color-fg-subtle)" opacity="0.4" />
              <text
                x="432"
                y="39"
                fill="var(--color-fg-subtle)"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                TARGET
              </text>
              <text
                x="432"
                y="54"
                fill="var(--color-fg-subtle)"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                opacity="0.75"
              >
                UNRESOLVED
              </text>
            </svg>
          </div>

          <h1 className={styles.heading}>Page or resource not found</h1>
          <p className={styles.description}>{message}</p>

          {/* Action Button */}
          <div className={styles.actionsRow}>
            <Link to="/" className={styles.primaryBtn}>
              <Home size={16} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

NotFoundPage.propTypes = {
  context: PropTypes.object,
};

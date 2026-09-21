// Shared design tokens. Keep page-specific presentation in assets/css/pages/.
if (window.tailwind) {
  tailwind.config = {
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "on-secondary": "#27313e",
        "on-error-container": "#ffdad6",
        "on-primary": "#253049",
        "on-surface-variant": "#c6c6ce",
        "secondary-fixed": "#d9e3f4",
        "secondary": "#bdc7d7",
        "surface-dim": "#121315",
        "surface-container-low": "#1b1c1e",
        "tertiary": "#b8c6f0",
        "surface-container-high": "#292a2c",
        "on-tertiary": "#212f51",
        "on-primary-container": "#323d57",
        "on-secondary-container": "#acb6c6",
        "secondary-container": "#3e4755",
        "surface-container-highest": "#343537",
        "surface-container-lowest": "#0d0e10",
        "on-tertiary-fixed": "#0a1a3b",
        "surface-variant": "#343537",
        "error-container": "#93000a",
        "background": "#121315",
        "on-surface": "#e3e2e4",
        "on-background": "#e3e2e4",
        "surface-container": "#1f2022",
        "on-primary-fixed": "#0f1b33",
        "outline": "#8f9098",
        "surface": "#121315",
        "primary-container": "#9da8c7",
        "primary-fixed-dim": "#bbc6e6",
        "tertiary-container": "#9aa8d0",
        "inverse-surface": "#e3e2e4",
        "outline-variant": "#45464d",
        "on-tertiary-fixed-variant": "#384669",
        "inverse-primary": "#535e7a",
        "surface-bright": "#38393b",
        "error": "#ffb4ab",
        "on-error": "#690005",
        "on-primary-fixed-variant": "#3b4661",
        "primary": "#bbc6e6",
        "on-secondary-fixed-variant": "#3e4755",
        "on-secondary-fixed": "#121c28",
        "tertiary-fixed-dim": "#b8c6f0",
        "tertiary-fixed": "#d9e2ff",
        "surface-tint": "#bbc6e6",
        "primary-fixed": "#d9e2ff",
        "inverse-on-surface": "#303032",
        "secondary-fixed-dim": "#bdc7d7",
        "on-tertiary-container": "#2f3d5f",
        "surface-lowest": "#0d0e10",
        "surface-low": "#1b1c1e",
        "surface-high": "#292a2c",
        "paper": "#e3e2e4",
        "muted": "#8f9098",
        "line": "#45464d"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "margin": "3rem",
        "space-xl": "3rem",
        "space-md": "1rem",
        "gutter-mobile": "0.75rem",
        "margin-mobile": "1.25rem",
        "space-xs": "0.25rem",
        "margin-tablet": "2rem",
        "gutter": "1.25rem",
        "space-lg": "1.75rem",
        "space-sm": "0.5rem"
      },
      "fontFamily": {
        "label-code": [
          "JetBrains Mono",
          "monospace"
        ],
        "label-catalog": [
          "JetBrains Mono",
          "monospace"
        ],
        "body-lg": [
          "Noto Sans",
          "Noto Sans KR",
          "Noto Sans JP",
          "sans-serif"
        ],
        "label-micro": [
          "JetBrains Mono",
          "monospace"
        ],
        "display-hero-mobile": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "headline-lg-mobile": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "body-sm": [
          "Noto Sans",
          "Noto Sans KR",
          "Noto Sans JP",
          "sans-serif"
        ],
        "headline-md": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "headline-lg": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "body-md": [
          "Noto Sans",
          "Noto Sans KR",
          "Noto Sans JP",
          "sans-serif"
        ],
        "display-hero": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "headline-sm": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "serif": [
          "EB Garamond",
          "Noto Serif KR",
          "Noto Serif JP",
          "serif"
        ],
        "sans": [
          "Noto Sans",
          "Noto Sans KR",
          "Noto Sans JP",
          "sans-serif"
        ],
        "mono": [
          "JetBrains Mono",
          "monospace"
        ]
      },
      "fontSize": {
        "label-code": [
          "11px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.08em",
            "fontWeight": "400"
          }
        ],
        "label-catalog": [
          "10px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.14em",
            "fontWeight": "500"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "28px",
            "letterSpacing": "-0.01em",
            "fontWeight": "300"
          }
        ],
        "label-micro": [
          "9px",
          {
            "lineHeight": "12px",
            "letterSpacing": "0.18em",
            "fontWeight": "400"
          }
        ],
        "display-hero-mobile": [
          "36px",
          {
            "lineHeight": "44px",
            "letterSpacing": "-0.01em",
            "fontWeight": "400"
          }
        ],
        "headline-lg-mobile": [
          "26px",
          {
            "lineHeight": "34px",
            "letterSpacing": "0em",
            "fontWeight": "400"
          }
        ],
        "body-sm": [
          "12px",
          {
            "lineHeight": "20px",
            "letterSpacing": "0em",
            "fontWeight": "400"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "0.01em",
            "fontWeight": "400"
          }
        ],
        "headline-lg": [
          "36px",
          {
            "lineHeight": "44px",
            "letterSpacing": "0em",
            "fontWeight": "400"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "24px",
            "letterSpacing": "-0.005em",
            "fontWeight": "300"
          }
        ],
        "display-hero": [
          "56px",
          {
            "lineHeight": "64px",
            "letterSpacing": "-0.01em",
            "fontWeight": "400"
          }
        ],
        "headline-sm": [
          "19px",
          {
            "lineHeight": "26px",
            "letterSpacing": "0.02em",
            "fontWeight": "500"
          }
        ]
      }
    }
  }
};
}

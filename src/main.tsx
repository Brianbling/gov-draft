import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { I18nextProvider } from "react-i18next"

import "./index.css"
import i18n from "./locales"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { ExternalLinkGuard } from "./components/external-link-guard.tsx"
import { DebugPanel } from "./components/debug-panel.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ExternalLinkGuard />
        {import.meta.env.DEV ? <DebugPanel /> : null}
        <main data-ui-scroll-container><App /></main>
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>
)

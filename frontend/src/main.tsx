import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { PopupProvider } from "./lib/popups";
import { initLanguage } from "./lib/i18n";
import { initTheme } from "./lib/theme";
import { loadAppearance } from "./lib/appearance";
import "./styles.css";

// Initialize language on app startup
initLanguage();
initTheme();
loadAppearance();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PopupProvider>
          <App />
        </PopupProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

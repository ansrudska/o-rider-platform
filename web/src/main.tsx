import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { initFirebase } from "./services/firebase";
import App from "./App";
import "leaflet/dist/leaflet.css";
import "./index.css";

initFirebase()
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Firebase init failed:", err);
    document.getElementById("root")!.innerHTML =
      `<div style="padding:2rem;text-align:center;color:#666">
        <h2>앱을 불러오지 못했습니다</h2>
        <p style="font-size:14px">${err.message}</p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:8px 16px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer">새로고침</button>
      </div>`;
  });


import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStrava } from "../hooks/useStrava";
import { useAuth } from "../contexts/AuthContext";

type Step = "verifying" | "exchanging" | "done" | "error";

export default function StravaCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exchangeCode } = useStrava();
  const [step, setStep] = useState<Step>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = sessionStorage.getItem("strava_state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStep("error");
      setErrorMsg("Strava 연동이 거부되었습니다.");
      return;
    }

    if (!code || !state || state !== storedState) {
      setStep("error");
      setErrorMsg("잘못된 요청입니다. 다시 시도해주세요.");
      return;
    }

    if (!user) {
      setStep("error");
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    sessionStorage.removeItem("strava_state");

    (async () => {
      try {
        setStep("exchanging");
        await exchangeCode(code);
        setStep("done");

        // Redirect to stored return path or /migrate
        const returnTo = sessionStorage.getItem("strava_return_to") || "/migrate";
        sessionStorage.removeItem("strava_return_to");
        setTimeout(() => navigate(returnTo), 1500);
      } catch {
        setStep("error");
        setErrorMsg("Strava 연동 중 오류가 발생했습니다.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
          {step === "error" ? (
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : step === "done" ? (
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900">
          {step === "verifying" && "확인 중..."}
          {step === "exchanging" && "Strava 연동 중..."}
          {step === "done" && "연동 완료!"}
          {step === "error" && "오류 발생"}
        </h2>

        <p className="text-sm text-gray-500">
          {step === "verifying" && "요청을 확인하고 있습니다."}
          {step === "exchanging" && "Strava 계정을 연결하고 있습니다."}
          {step === "done" && "잠시 후 이동합니다."}
          {step === "error" && errorMsg}
        </p>

        {step === "error" && (
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
          >
            홈으로 이동
          </button>
        )}

        {/* Progress bar */}
        {step !== "error" && step !== "done" && (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
              style={{
                width:
                  step === "verifying" ? "20%" :
                  step === "exchanging" ? "60%" :
                  "100%",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

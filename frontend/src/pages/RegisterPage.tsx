import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../App";

const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "") + "/api";

axios.defaults.baseURL = API_BASE;

axios.defaults.xsrfCookieName = "csrftoken";
axios.defaults.xsrfHeaderName = "X-CSRFToken";
axios.defaults.withCredentials = true;
axios.defaults.headers.common["Content-Type"] = "application/json";

function getCookie(name: string): string | null {
  let cookieValue = null;

  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();

      if (
        cookie.substring(0, name.length + 1) ===
        name + "="
      ) {
        cookieValue = decodeURIComponent(
          cookie.substring(name.length + 1)
        );
        break;
      }
    }
  }

  return cookieValue;
}

/* =========================================================
   OAuth user parser
========================================================= */

function parseOAuthUser(userParam: string | null) {
  if (!userParam) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(userParam);
    return JSON.parse(decoded);
  } catch {
    try {
      return JSON.parse(userParam);
    } catch {
      return null;
    }
  }
}

/* =========================================================
   REGISTER PAGE
========================================================= */

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<
    "register" | "otp-verify"
  >("register");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [oauthLoading, setOauthLoading] = useState<
    "google" | "github" | null
  >(null);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  /*
   * Prevent OAuth callback from being processed
   * more than once in React development mode.
   */
  const oauthProcessedRef = useRef(false);

  /* =========================================================
     OAUTH CALLBACK HANDLER
  ========================================================= */

  useEffect(() => {
    if (oauthProcessedRef.current) {
      return;
    }

    const params = new URLSearchParams(
      window.location.search
    );

    const accessToken =
      params.get("access_token");

    const refreshToken =
      params.get("refresh_token");

    const userParam =
      params.get("user");

    const error =
      params.get("error");

    /*
     * No OAuth callback data.
     * Normal register page — do nothing.
     */
    if (
      !accessToken &&
      !refreshToken &&
      !error
    ) {
      return;
    }

    oauthProcessedRef.current = true;

    if (error) {
      const readableError =
        error.replace(/\+/g, " ");

      toast.error(
        readableError ||
          "Social authentication failed."
      );

      /*
       * Remove callback params but stay on register page.
       */
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      return;
    }

    if (!accessToken) {
      toast.error(
        "Authentication token was not received."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      return;
    }

    try {
      const oauthUser =
        parseOAuthUser(userParam);

      /*
       * Save access token.
       */
      localStorage.setItem(
        "access_token",
        accessToken
      );

      /*
       * Save refresh token when available.
       */
      if (refreshToken) {
        localStorage.setItem(
          "refresh_token",
          refreshToken
        );
      }

      /*
       * Build a safe user object for AuthContext.
       */
      const userData = {
        id: oauthUser?.id ?? 0,
        email:
          oauthUser?.email ?? "",
        name:
          oauthUser?.name ??
          oauthUser?.email ??
          "User",
        first_name:
          oauthUser?.first_name ??
          "",
        last_name:
          oauthUser?.last_name ??
          "",
        avatar:
          oauthUser?.avatar ??
          null,
      };

      /*
       * Important:
       * AuthContext must receive the same token
       * that backend generated.
       */
      login(
        accessToken,
        userData
      );

      /*
       * Remove OAuth query parameters from URL
       * before redirecting.
       */
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      toast.success(
        "Welcome to Quill! 🎉"
      );

      /*
       * Correct destination:
       * website/dashboard instead of register page.
       */
      navigate(
        "/dashboard",
        {
          replace: true,
        }
      );
    } catch (oauthError) {
      console.error(
        "OAuth callback processing failed:",
        oauthError
      );

      localStorage.removeItem(
        "access_token"
      );

      localStorage.removeItem(
        "refresh_token"
      );

      toast.error(
        "Unable to complete social login."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, [login, navigate]);

  /* =========================================================
     OTP COUNTDOWN
  ========================================================= */

  useEffect(() => {
    if (mode === "otp-verify") {
      setCountdown(60);
      setCanResend(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current =
        setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (timerRef.current) {
                clearInterval(
                  timerRef.current
                );
              }

              setCanResend(true);

              return 0;
            }

            return prev - 1;
          });
        }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, [mode]);

  /* =========================================================
     REGISTER
  ========================================================= */

  const handleRegister = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      toast.error(
        "Please fill in all fields"
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      toast.error(
        "Passwords do not match"
      );
      return;
    }

    if (password.length < 8) {
      toast.error(
        "Password must be at least 8 characters"
      );
      return;
    }

    if (!agreeTerms) {
      toast.error(
        "Please agree to the Terms of Service"
      );
      return;
    }

    setLoading(true);

    try {
      const csrfToken =
        getCookie("csrftoken");

      const headers: Record<
        string,
        string
      > = {
        "Content-Type":
          "application/json",
      };

      if (csrfToken) {
        headers["X-CSRFToken"] =
          csrfToken;
      }

      const res =
        await axios.post(
          "/auth/register/",
          {
            first_name:
              name.split(" ")[0],
            last_name:
              name
                .split(" ")
                .slice(1)
                .join(" ") || "",
            email,
            password,
            confirm_password:
              confirmPassword,
          },
          {
            headers,
          }
        );

      if (
        res.data.requires_otp
      ) {
        setMode(
          "otp-verify"
        );

        toast.success(
          res.data.message ||
            "OTP sent to your email"
        );

        return;
      }

      if (
        res.data.data?.access
      ) {
        login(
          res.data.data.access,
          res.data.data.user || {
            id: 0,
            email,
            name,
          }
        );

        if (
          res.data.data
            ?.refresh
        ) {
          localStorage.setItem(
            "refresh_token",
            res.data.data.refresh
          );
        }

        toast.success(
          "Welcome to Quill! 🎉"
        );

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      }
    } catch (err: any) {
      if (
        err.response?.status ===
          403 &&
        err.response?.data
          ?.requires_otp
      ) {
        setMode(
          "otp-verify"
        );

        toast.success(
          err.response.data.message ||
            "OTP sent to your email"
        );

        return;
      }

      console.error(
        "🔴 REGISTER ERROR:",
        err.response
      );

      const data =
        err?.response?.data;

      let message =
        "Registration failed";

      if (data?.errors) {
        const msgs =
          Object.entries(
            data.errors
          ).map(
            ([key, value]) => {
              if (
                Array.isArray(
                  value
                )
              ) {
                return `${key}: ${value[0]}`;
              }

              return `${key}: ${value}`;
            }
          );

        message =
          msgs.join(
            " | "
          );
      } else if (
        data?.email
      ) {
        message =
          Array.isArray(
            data.email
          )
            ? data.email[0]
            : data.email;
      } else if (
        data?.password
      ) {
        message =
          Array.isArray(
            data.password
          )
            ? data.password[0]
            : data.password;
      } else if (
        data?.non_field_errors
      ) {
        message =
          Array.isArray(
            data.non_field_errors
          )
            ? data.non_field_errors[0]
            : data.non_field_errors;
      } else if (
        data?.message
      ) {
        message =
          data.message;
      } else if (
        data?.detail
      ) {
        message =
          data.detail;
      } else if (
        typeof data ===
        "string"
      ) {
        message = data;
      } else if (data) {
        message =
          JSON.stringify(
            data
          );
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     OTP VERIFY
  ========================================================= */

  const handleOtpVerify =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (!otp) {
        toast.error(
          "Please enter the OTP"
        );
        return;
      }

      if (otp.length !== 6) {
        toast.error(
          "OTP must be 6 digits"
        );
        return;
      }

      setLoading(true);

      try {
        const csrfToken =
          getCookie(
            "csrftoken"
          );

        const headers: Record<
          string,
          string
        > = {
          "Content-Type":
            "application/json",
        };

        if (csrfToken) {
          headers[
            "X-CSRFToken"
          ] = csrfToken;
        }

        const res =
          await axios.post(
            "/auth/otp/verify/",
            {
              email,
              otp_code: otp,
              purpose:
                "register",
            },
            {
              headers,
            }
          );

        if (
          res.data.data?.access
        ) {
          login(
            res.data.data.access,
            res.data.data.user || {
              id: 0,
              email,
              name,
            }
          );

          if (
            res.data.data
              ?.refresh
          ) {
            localStorage.setItem(
              "refresh_token",
              res.data.data.refresh
            );
          }

          toast.success(
            "Welcome to Quill! 🎉"
          );

          navigate(
            "/dashboard",
            {
              replace: true,
            }
          );
        } else {
          toast.success(
            "OTP verified! Please login."
          );

          setMode(
            "register"
          );
        }
      } catch (err: any) {
        const msg =
          err?.response
            ?.data?.message ||
          err?.response
            ?.data?.detail ||
          "Invalid or expired OTP";

        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

  /* =========================================================
     RESEND OTP
  ========================================================= */

  const handleResendOtp =
    async () => {
      if (!canResend) {
        return;
      }

      try {
        const csrfToken =
          getCookie(
            "csrftoken"
          );

        const headers: Record<
          string,
          string
        > = {
          "Content-Type":
            "application/json",
        };

        if (csrfToken) {
          headers[
            "X-CSRFToken"
          ] = csrfToken;
        }

        await axios.post(
          "/auth/otp/send/",
          {
            email,
            purpose:
              "register",
          },
          {
            headers,
          }
        );

        toast.success(
          "OTP resent! Check your email."
        );

        setCanResend(
          false
        );

        setCountdown(
          60
        );

        if (
          timerRef.current
        ) {
          clearInterval(
            timerRef.current
          );
        }

        timerRef.current =
          setInterval(() => {
            setCountdown(
              (prev) => {
                if (
                  prev <= 1
                ) {
                  if (
                    timerRef.current
                  ) {
                    clearInterval(
                      timerRef.current
                    );
                  }

                  setCanResend(
                    true
                  );

                  return 0;
                }

                return (
                  prev - 1
                );
              }
            );
          }, 1000);
      } catch (err: any) {
        toast.error(
          err?.response
            ?.data?.message ||
            "Failed to resend OTP"
        );
      }
    };

  /* =========================================================
     OAUTH
  ========================================================= */

  const getOAuthUrl = (
    provider:
      | "google"
      | "github"
  ) => {
    /*
     * IMPORTANT:
     * OAuth callback comes back to /register.
     * RegisterPage's callback useEffect above will
     * consume the tokens and immediately redirect
     * to /dashboard.
     */
    const redirectUri =
      `${window.location.origin}/register`;

    return (
      `${API_BASE}/auth/${provider}/` +
      `?redirect_uri=${encodeURIComponent(
        redirectUri
      )}`
    );
  };

  const handleOAuth = (
    provider:
      | "google"
      | "github"
  ) => {
    setOauthLoading(
      provider
    );

    window.location.href =
      getOAuthUrl(
        provider
      );
  };

  /* =========================================================
     ICONS
  ========================================================= */

  const UserIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle
        cx="12"
        cy="7"
        r="4"
      />
    </svg>
  );

  const EmailIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );

  const LockIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="4"
        y="10"
        width="16"
        height="11"
        rx="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );

  const EyeIcon = ({
    off = false,
  }: {
    off?: boolean;
  }) => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 4.1" />
          <path d="M6.2 6.2C3.5 8.2 2.5 12 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 3-.5" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
          <circle
            cx="12"
            cy="12"
            r="2.5"
          />
        </>
      )}
    </svg>
  );

  const GoogleIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
    >
      <path
        fill="#EA4335"
        d="M12 5.04c1.86 0 3.52.64 4.83 1.9l3.62-3.62C17.95 1.18 15.24 0 12 0 7.27 0 3.18 2.69 1.23 6.61l4.18 3.24C6.22 6.74 8.86 5.04 12 5.04z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.23c0-.86-.08-1.68-.22-2.47H12v4.68h6.45c-.28 1.48-1.11 2.73-2.36 3.57l3.82 2.96c2.23-2.06 3.59-5.09 3.59-8.74z"
      />
      <path
        fill="#FBBC05"
        d="M5.41 9.15L1.23 5.91C.44 7.48 0 9.25 0 11.13s.44 3.65 1.23 5.22l4.18-3.24c-.25-.74-.39-1.53-.39-2.36s.14-1.62.39-2.36z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.82-2.96c-1.07.72-2.44 1.14-4.12 1.14-3.14 0-5.78-1.7-7.12-4.22L1.7 17.29C3.65 21.31 7.74 24 12 24z"
      />
    </svg>
  );

  const GithubIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.167 6.839 9.49.5.092.682-.217.682-.483 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.455-1.157-1.11-1.466-1.11-1.466-.908-.621.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.35-1.087.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.58 9.58 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .268.18.58.688.482A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z"
        clipRule="evenodd"
      />
    </svg>
  );

  /* =========================================================
     TRANSLATION BUBBLE
  ========================================================= */

  const TranslationBubble = ({
    countryCode,
    text,
    className,
    delay,
  }: {
    countryCode: string;
    text: string;
    className: string;
    delay: string;
  }) => (
    <div
      className={`absolute ${className}`}
      style={{
        animationDelay: delay,
      }}
    >
      <div className="translation-bubble">
        <span className="flag-circle">
          <img
            src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
            alt={`${countryCode} flag`}
            className="country-flag"
          />
        </span>

        <span className="bubble-text">
          {text}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="login-page">
        <div className="background-effects">
          <div className="background-blue" />
          <div className="background-purple" />
          <div className="background-pink" />
        </div>

        <div className="auth-card">
          <section className="visual-panel">
            <div className="world-map">
              <div className="world-map-image" />
            </div>

            <div className="world-map-dots" />

            <div className="connection-line line-one" />
            <div className="connection-line line-two" />
            <div className="connection-line line-three" />
            <div className="connection-line line-four" />
            <div className="connection-line line-five" />

            <span className="connection-dot dot-one" />
            <span className="connection-dot dot-two" />
            <span className="connection-dot dot-three" />
            <span className="connection-dot dot-four" />
            <span className="connection-dot dot-five" />
            <span className="connection-dot dot-six" />

            <div className="visual-content">
              <p className="brand-small">
                QUILL
              </p>

              <h2>
                Where words and
                <br />
                <span>
                  documents come together.
                </span>
              </h2>

              <p className="visual-subtitle">
                Translate. Create. Organize.
              </p>
            </div>

            <TranslationBubble
              countryCode="US"
              text="Hello, how are you?"
              className="bubble-one floating-slow"
              delay="0s"
            />

            <TranslationBubble
              countryCode="ES"
              text="Hola, ¿cómo estás?"
              className="bubble-two floating-medium"
              delay="1s"
            />

            <TranslationBubble
              countryCode="FR"
              text="Bonjour, comment allez-vous?"
              className="bubble-three floating-slow"
              delay="0.5s"
            />

            <TranslationBubble
              countryCode="CN"
              text="你好，你好吗？"
              className="bubble-four floating-medium"
              delay="1.5s"
            />

            <TranslationBubble
              countryCode="SA"
              text="مرحبا، كيف حالك؟"
              className="bubble-five floating-slow"
              delay="0.8s"
            />

            <TranslationBubble
              countryCode="JP"
              text="こんにちは、お元気ですか？"
              className="bubble-six floating-slow"
              delay="1.2s"
            />

            <TranslationBubble
              countryCode="DE"
              text="Hallo, wie geht es dir?"
              className="bubble-seven floating-medium"
              delay="1.8s"
            />

            <TranslationBubble
              countryCode="IN"
              text="नमस्ते, आप कैसे हैं?"
              className="bubble-eight floating-slow"
              delay="0.6s"
            />

            <div className="left-glow" />
            <div className="map-overlay" />
          </section>

          <section className="login-panel">
            <div className="login-content">
              {mode === "register" && (
                <>
                  <div className="welcome-header">
                    <img
                      src="/quill_logo.png"
                      alt="quill logo"
                      className="welcome-logo"
                    />

                    <div className="welcome-text">
                      <h1>
                        Create account
                      </h1>

                      <p>
                        Your all-in-one workspace for words and documents.
                      </p>
                    </div>
                  </div>

                  <div className="social-buttons">
                    <button
                      type="button"
                      onClick={() =>
                        handleOAuth(
                          "google"
                        )
                      }
                      disabled={
                        oauthLoading !== null
                      }
                      className="social-button"
                    >
                      {oauthLoading ===
                      "google" ? (
                        <span className="social-spinner google-spinner" />
                      ) : (
                        <GoogleIcon />
                      )}

                      <span>
                        {oauthLoading ===
                        "google"
                          ? "Connecting..."
                          : "Google"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleOAuth(
                          "github"
                        )
                      }
                      disabled={
                        oauthLoading !== null
                      }
                      className="social-button"
                    >
                      {oauthLoading ===
                      "github" ? (
                        <span className="social-spinner github-spinner" />
                      ) : (
                        <GithubIcon />
                      )}

                      <span>
                        {oauthLoading ===
                        "github"
                          ? "Connecting..."
                          : "GitHub"}
                      </span>
                    </button>
                  </div>

                  <div className="divider">
                    <span />
                    <p>or</p>
                    <span />
                  </div>

                  <form
                    onSubmit={
                      handleRegister
                    }
                    className="login-form"
                  >
                    <div className="form-group">
                      <label htmlFor="name">
                        Full name
                      </label>

                      <div className="input-wrapper">
                        <span className="input-icon">
                          <UserIcon />
                        </span>

                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) =>
                            setName(
                              e.target.value
                            )
                          }
                          placeholder="John Doe"
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">
                        Email address
                      </label>

                      <div className="input-wrapper">
                        <span className="input-icon">
                          <EmailIcon />
                        </span>

                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) =>
                            setEmail(
                              e.target.value
                            )
                          }
                          placeholder="you@example.com"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="password">
                        Password
                      </label>

                      <div className="input-wrapper">
                        <span className="input-icon">
                          <LockIcon />
                        </span>

                        <input
                          id="password"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          value={password}
                          onChange={(e) =>
                            setPassword(
                              e.target.value
                            )
                          }
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                          required
                        />

                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          <EyeIcon
                            off={
                              !showPassword
                            }
                          />
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirmPassword">
                        Confirm password
                      </label>

                      <div className="input-wrapper">
                        <span className="input-icon">
                          <LockIcon />
                        </span>

                        <input
                          id="confirmPassword"
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={
                            confirmPassword
                          }
                          onChange={(e) =>
                            setConfirmPassword(
                              e.target.value
                            )
                          }
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          required
                        />

                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword
                            )
                          }
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          <EyeIcon
                            off={
                              !showConfirmPassword
                            }
                          />
                        </button>
                      </div>
                    </div>

                    <div
                      className="form-options"
                      style={{
                        justifyContent:
                          "flex-start",
                      }}
                    >
                      <label className="remember-label">
                        <input
                          type="checkbox"
                          checked={
                            agreeTerms
                          }
                          onChange={(e) =>
                            setAgreeTerms(
                              e.target.checked
                            )
                          }
                        />

                        <span className="custom-check" />

                        <span>
                          I agree to the{" "}
                          <span className="terms-link">
                            Terms
                          </span>{" "}
                          &{" "}
                          <span className="terms-link">
                            Privacy
                          </span>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="login-button"
                    >
                      {loading ? (
                        <span className="loading-content">
                          <span className="white-spinner" />
                          Creating account...
                        </span>
                      ) : (
                        "Create account"
                      )}
                    </button>
                  </form>

                  <p className="signup-text">
                    Already have an account?{" "}
                    <Link to="/login">
                      Login
                    </Link>
                  </p>
                </>
              )}

              {mode === "otp-verify" && (
                <>
                  <div className="otp-header">
                    <img
                      src="/quill_logo.png"
                      alt="quill logo"
                      className="otp-logo"
                    />

                    <h1>
                      Verify your email
                    </h1>

                    <p>
                      We sent a 6-digit
                      code to
                      <br />
                      <strong>
                        {email}
                      </strong>
                    </p>
                  </div>

                  <div className="otp-countdown">
                    <span className="countdown-icon">
                      ⏱️
                    </span>

                    <span
                      className={
                        countdown === 0
                          ? "expired"
                          : ""
                      }
                    >
                      {countdown >
                      0
                        ? `OTP expires in ${countdown}s`
                        : "OTP expired — request new one"}
                    </span>
                  </div>

                  <form
                    onSubmit={
                      handleOtpVerify
                    }
                    className="otp-form"
                  >
                    <div className="form-group">
                      <label htmlFor="otp">
                        Verification code
                      </label>

                      <input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) =>
                          setOtp(
                            e.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                6
                              )
                          )
                        }
                        className="otp-input"
                        placeholder="000000"
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        otp.length !== 6 ||
                        countdown === 0
                      }
                      className="login-button"
                    >
                      {loading ? (
                        <span className="loading-content">
                          <span className="white-spinner" />
                          Verifying...
                        </span>
                      ) : (
                        "Verify & Continue"
                      )}
                    </button>

                    <div className="otp-actions">
                      <button
                        type="button"
                        className={`back-login ${
                          !canResend
                            ? "disabled"
                            : ""
                        }`}
                        onClick={
                          handleResendOtp
                        }
                        disabled={
                          !canResend
                        }
                      >
                        {canResend
                          ? "Resend OTP"
                          : `Resend in ${countdown}s`}
                      </button>

                      <span className="action-sep">
                        |
                      </span>

                      <button
                        type="button"
                        className="back-login"
                        onClick={() => {
                          setMode(
                            "register"
                          );
                          setOtp("");
                        }}
                      >
                        ← Back
                      </button>
                    </div>
                  </form>
                </>
              )}

              <p className="terms-text">
                By continuing, you agree
                to our{" "}
                <span>
                  Terms of Service
                </span>{" "}
                and{" "}
                <span>
                  Privacy Policy
                </span>
              </p>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }
        #root { scrollbar-width: none; -ms-overflow-style: none; }
        #root::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .login-page { min-height: 100vh; width: 100%; padding: 24px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: #f7f8ff; scrollbar-width: none; -ms-overflow-style: none; }
        .login-page::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .background-effects { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
        .background-blue { position: absolute; width: 600px; height: 600px; top: -300px; left: -250px; border-radius: 50%; background: rgba(191, 219, 254, 0.45); filter: blur(120px); }
        .background-purple { position: absolute; width: 600px; height: 600px; right: -300px; bottom: -300px; border-radius: 50%; background: rgba(221, 214, 254, 0.5); filter: blur(120px); }
        .background-pink { position: absolute; width: 450px; height: 450px; left: 40%; bottom: -300px; border-radius: 50%; background: rgba(251, 207, 232, 0.25); filter: blur(120px); }
        .auth-card { position: relative; z-index: 2; width: min(1400px, calc(100vw - 48px)); height: min(800px, calc(100vh - 48px)); min-height: 580px; display: grid; grid-template-columns: 60% 40%; overflow: hidden; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.9); background: rgba(255, 255, 255, 0.82); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); box-shadow: 0 30px 100px rgba(55, 65, 120, 0.14); scrollbar-width: none; -ms-overflow-style: none; }
        .visual-panel { position: relative; overflow: hidden; background: linear-gradient(135deg, #eef3ff 0%, #f8f7ff 48%, #fff4f8 100%); }
        .world-map { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1; overflow: hidden; }
        .world-map-image { position: absolute; width: 120%; height: 65%; top: 22%; left: -10%; opacity: 0.105; background-image: url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg"); background-repeat: no-repeat; background-position: center; background-size: contain; filter: grayscale(1) contrast(0.75); transform: scale(1.15); }
        .map-overlay { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0) 25%, rgba(255, 255, 255, 0.25) 75%, rgba(255, 255, 255, 0.45) 100%); }
        .world-map-dots { position: absolute; width: 90%; height: 48%; top: 29%; left: 5%; opacity: 0.42; background-image: radial-gradient(circle, rgba(99, 102, 241, 0.17) 1.2px, transparent 1.2px); background-size: 9px 9px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 72%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 72%); transform: scaleX(1.3); z-index: 2; }
        .visual-content { position: relative; z-index: 10; padding: clamp(36px, 6vh, 72px) clamp(30px, 4vw, 60px); }
        .brand-small { margin: 0 0 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #6366f1; }
        .visual-content h2 { margin: 0; font-size: clamp(32px, 3.5vw, 52px); line-height: 1.05; letter-spacing: -0.045em; font-weight: 750; color: #17203a; }
        .visual-content h2 span { background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .visual-subtitle { margin-top: 16px; font-size: clamp(14px, 1.2vw, 17px); line-height: 1.5; color: #64748b; }
        .translation-bubble { display: flex; align-items: center; gap: 8px; padding: 7px 12px 7px 8px; border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 999px; background: rgba(255, 255, 255, 0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 35px rgba(80, 90, 140, 0.09); white-space: nowrap; }
        .flag-circle { width: 27px; height: 27px; min-width: 27px; min-height: 27px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; background: #ffffff; border: 1px solid rgba(255, 255, 255, 0.95); box-shadow: 0 2px 7px rgba(15, 23, 42, 0.12); flex-shrink: 0; }
        .country-flag { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 50%; }
        .bubble-text { font-size: 12px; font-weight: 500; color: #334155; }
        .bubble-one { top: 16%; left: 7%; }
        .bubble-two { top: 20%; right: 8%; }
        .bubble-three { top: 38%; right: 4%; }
        .bubble-four { top: 52%; left: 7%; }
        .bubble-five { top: 55%; right: 18%; }
        .bubble-six { bottom: 27%; left: 12%; }
        .bubble-seven { bottom: 20%; right: 8%; }
        .bubble-eight { bottom: 10%; left: 32%; }
        .floating-slow { animation: floatingSlow 6s ease-in-out infinite; }
        .floating-medium { animation: floatingMedium 5s ease-in-out infinite; }
        @keyframes floatingSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes floatingMedium { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(9px); } }
        .connection-line { position: absolute; border-color: rgba(129, 140, 248, 0.23); z-index: 4; }
        .line-one { top: 24%; left: 20%; width: 210px; height: 110px; border-top: 1px solid; border-right: 1px solid; border-radius: 0 100px 0 0; transform: rotate(15deg); }
        .line-two { top: 40%; left: 38%; width: 190px; height: 140px; border-top: 1px solid; border-left: 1px solid; border-radius: 100px 0 0 0; transform: rotate(-20deg); }
        .line-three { top: 56%; left: 22%; width: 260px; height: 140px; border-bottom: 1px solid; border-right: 1px solid; border-radius: 0 0 100px 0; transform: rotate(-10deg); }
        .line-four { top: 67%; left: 47%; width: 170px; height: 100px; border-top: 1px solid; border-radius: 100px 100px 0 0; transform: rotate(25deg); }
        .line-five { top: 31%; left: 53%; width: 130px; height: 90px; border-bottom: 1px solid; border-left: 1px solid; border-radius: 0 0 0 80px; transform: rotate(-15deg); }
        .connection-dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 0 5px rgba(139, 92, 246, 0.08), 0 0 18px rgba(139, 92, 246, 0.25); animation: pulseDot 3s ease-in-out infinite; z-index: 5; }
        .dot-one { top: 25%; left: 39%; }
        .dot-two { top: 40%; left: 59%; }
        .dot-three { top: 57%; left: 29%; }
        .dot-four { top: 68%; left: 48%; }
        .dot-five { top: 78%; left: 61%; }
        .dot-six { top: 34%; left: 72%; }
        @keyframes pulseDot { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }
        .left-glow { position: absolute; width: 500px; height: 250px; bottom: -150px; left: 20%; border-radius: 50%; background: rgba(251, 207, 232, 0.35); filter: blur(90px); z-index: 2; }
        .login-panel { position: relative; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.88); overflow: hidden; }
        .login-content { width: 100%; max-width: 480px; padding: 28px 36px; }
        .welcome-header { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px; text-align: left; }
        .welcome-logo { width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }
        .welcome-text h1 { margin: 0; font-size: clamp(22px, 2vw, 28px); line-height: 1.1; font-weight: 750; letter-spacing: -0.04em; color: #17203a; }
        .welcome-text p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: #64748b; }
        .otp-header { text-align: center; margin-bottom: 14px; }
        .otp-logo { width: 48px; height: 48px; object-fit: contain; margin: 0 auto 10px; }
        .otp-header h1 { margin: 0; font-size: 24px; font-weight: 750; color: #17203a; }
        .otp-header p { margin-top: 6px; color: #64748b; font-size: 12px; line-height: 1.5; }
        .otp-header strong { color: #334155; }
        .otp-countdown { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 14px; padding: 8px 14px; border-radius: 8px; background: rgba(99, 102, 241, 0.06); color: #6366f1; font-size: 12px; font-weight: 600; }
        .otp-countdown .expired { color: #ef4444; }
        .countdown-icon { font-size: 14px; }
        .social-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .social-button { width: 100%; height: 40px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; color: #1e293b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .social-button:hover { border-color: #cbd5e1; box-shadow: 0 6px 18px rgba(30, 41, 59, 0.06); transform: translateY(-1px); }
        .social-button:disabled { opacity: 0.65; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
        .divider span { height: 1px; flex: 1; background: #e2e8f0; }
        .divider p { margin: 0; color: #94a3b8; font-size: 11px; }
        .login-form { display: flex; flex-direction: column; gap: 10px; }
        .form-group { width: 100%; }
        .form-group label { display: block; margin-bottom: 4px; color: #334155; font-size: 12px; font-weight: 500; }
        .input-wrapper { position: relative; width: 100%; }
        .input-wrapper input { width: 100%; height: 42px; display: block; padding: 0 40px; border: 1px solid #dbe3ef; border-radius: 10px; background: #ffffff; color: #17203a; font-size: 13px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .input-wrapper input::placeholder { color: #94a3b8; opacity: 1; font-size: 12px; }
        .input-wrapper input:hover { border-color: #cbd5e1; }
        .input-wrapper input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08); }
        .input-icon { position: absolute; left: 12px; top: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; transform: translateY(-50%); color: #94a3b8; pointer-events: none; z-index: 2; }
        .password-toggle { position: absolute; right: 10px; top: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; transform: translateY(-50%); border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0; z-index: 3; }
        .password-toggle:hover { color: #64748b; }
        .form-options { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px; }
        .remember-label { display: flex; align-items: center; gap: 6px; color: #475569; font-size: 11px; cursor: pointer; user-select: none; }
        .remember-label input { position: absolute; opacity: 0; pointer-events: none; }
        .custom-check { width: 15px; height: 15px; flex-shrink: 0; border: 1.5px solid #cbd5e1; border-radius: 4px; background: white; position: relative; transition: all 0.2s ease; }
        .remember-label input:checked + .custom-check { background: #6366f1; border-color: #6366f1; }
        .remember-label input:checked + .custom-check::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .terms-link { color: #6366f1; font-weight: 500; }
        .login-button { width: 100%; height: 42px; border: none; border-radius: 10px; background: linear-gradient(100deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%); color: white; font-size: 13px; font-weight: 650; cursor: pointer; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2); transition: all 0.2s ease; margin-top: 4px; }
        .login-button:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(99, 102, 241, 0.26); }
        .login-button:active { transform: translateY(0); }
        .login-button:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .signup-text { margin: 12px 0 0; text-align: center; color: #64748b; font-size: 12px; }
        .signup-text a { color: #6366f1; font-weight: 600; text-decoration: none; }
        .signup-text a:hover { color: #4f46e5; }
        .terms-text { margin: 14px 0 0; text-align: center; color: #94a3b8; font-size: 9px; line-height: 1.5; }
        .terms-text span { color: #64748b; }
        .otp-form { display: flex; flex-direction: column; gap: 14px; }
        .otp-input { width: 100%; height: 50px; border: 1px solid #dbe3ef; border-radius: 12px; text-align: center; font-size: 20px; font-family: monospace; font-weight: 600; letter-spacing: 0.5em; color: #17203a; outline: none; }
        .otp-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08); }
        .otp-actions { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 4px; }
        .otp-actions .action-sep { color: #cbd5e1; font-size: 12px; }
        .back-login { border: none; background: transparent; color: #64748b; cursor: pointer; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 6px; transition: all 0.2s ease; }
        .back-login:hover { color: #334155; background: rgba(100, 116, 139, 0.06); }
        .back-login.disabled { color: #94a3b8; cursor: not-allowed; background: transparent; }
        .loading-content { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .white-spinner, .social-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: white; animation: spin 0.8s linear infinite; }
        .social-spinner { border-color: #e2e8f0; }
        .google-spinner { border-top-color: #4285f4; }
        .github-spinner { border-top-color: #111827; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1200px) { .login-page { padding: 20px; } .auth-card { width: calc(100vw - 40px); height: calc(100vh - 40px); grid-template-columns: 60% 40%; } .login-content { padding: 24px 28px; } .visual-content { padding: 48px 32px; } .visual-content h2 { font-size: 36px; } .translation-bubble { padding: 6px 10px 6px 7px; } .bubble-text { font-size: 11px; } .flag-circle { width: 25px; height: 25px; min-width: 25px; min-height: 25px; } .social-buttons { grid-template-columns: 1fr; } .world-map-image { width: 130%; } }
        @media (max-width: 900px) { html, body, #root { height: auto; min-height: 100%; } .login-page { min-height: 100vh; height: auto; padding: 16px; overflow-y: auto; } .auth-card { width: calc(100vw - 32px); height: auto; min-height: calc(100vh - 32px); grid-template-columns: 1fr; overflow: hidden; } .visual-panel { min-height: 200px; } .visual-content { padding: 36px; } .visual-content h2 { font-size: 32px; } .bubble-five, .bubble-six, .bubble-seven, .bubble-eight { display: none; } .login-panel { min-height: auto; overflow: visible; } .login-content { max-width: 520px; padding: 28px; } .world-map-image { width: 120%; height: 90%; top: 5%; } }
        @media (max-width: 640px) { .login-page { padding: 0; align-items: stretch; min-height: 100vh; } .auth-card { width: 100%; min-height: 100vh; height: auto; border-radius: 0; border: none; box-shadow: none; grid-template-columns: 1fr; } .visual-panel { min-height: 160px; max-height: 180px; } .visual-content { padding: 24px 20px; } .brand-small { margin-bottom: 8px; font-size: 10px; } .visual-content h2 { font-size: 26px; } .visual-subtitle { margin-top: 8px; font-size: 12px; } .world-map-dots { top: 18%; height: 75%; } .world-map-image { width: 135%; height: 110%; top: -5%; left: -17%; opacity: 0.09; } .bubble-one { top: 12%; left: auto; right: 6%; } .bubble-two, .bubble-three, .bubble-four, .bubble-five, .bubble-six, .bubble-seven, .bubble-eight { display: none; } .bubble-text { font-size: 10px; } .translation-bubble { padding: 5px 8px 5px 6px; } .flag-circle { width: 23px; height: 23px; min-width: 23px; min-height: 23px; } .login-panel { min-height: auto; overflow: visible; align-items: flex-start; } .login-content { width: 100%; max-width: none; padding: 24px 20px 28px; } .welcome-header { justify-content: flex-start; gap: 10px; margin-bottom: 18px; } .welcome-logo { width: 40px; height: 40px; } .welcome-text h1 { font-size: 22px; } .welcome-text p { font-size: 11px; margin-top: 3px; } .social-buttons { grid-template-columns: 1fr 1fr; gap: 8px; } .social-button { height: 38px; font-size: 12px; } .divider { margin: 14px 0; } .form-group label { font-size: 12px; } .input-wrapper input { height: 42px; font-size: 13px; padding-left: 40px; padding-right: 40px; } .form-options { align-items: flex-start; margin-top: 0; } .remember-label { font-size: 11px; } .login-button { height: 42px; font-size: 13px; } .signup-text { font-size: 12px; margin-top: 14px; } .terms-text { margin-top: 14px; } .otp-logo { width: 44px; height: 44px; } .otp-header h1 { font-size: 22px; } .otp-input { height: 48px; font-size: 18px; } .otp-countdown { font-size: 11px; padding: 6px 10px; } }
        @media (max-width: 380px) { .visual-panel { min-height: 150px; } .visual-content { padding: 20px 16px; } .visual-content h2 { font-size: 23px; } .login-content { padding: 20px 16px 24px; } .welcome-logo { width: 36px; height: 36px; } .welcome-text h1 { font-size: 20px; } .welcome-text p { font-size: 10px; } .form-options { flex-direction: column; gap: 8px; } .world-map-image { width: 150%; } .flag-circle { width: 22px; height: 22px; min-width: 22px; min-height: 22px; } }
        @media (min-width: 901px) { html, body, #root { height: 100%; overflow: hidden; } .login-page { height: 100vh; min-height: 0; overflow: hidden; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </>
  );
};

export default RegisterPage;

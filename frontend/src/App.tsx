import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  Toaster,
} from "react-hot-toast";

import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

/* ============================================================
   API CONFIG
============================================================ */

const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "") + "/api";

axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true;

axios.defaults.xsrfCookieName =
  "csrftoken";

axios.defaults.xsrfHeaderName =
  "X-CSRFToken";

/*
  IMPORTANT:
  Do NOT set this globally:

  axios.defaults.headers.common["Content-Type"] =
    "application/json";

  Why?

  Speech upload uses FormData.
  Browser must generate:

  multipart/form-data; boundary=...

  automatically.

  Setting JSON globally can break multipart uploads.
*/

/* ============================================================
   TYPES
============================================================ */

type RetryableAxiosConfig =
  InternalAxiosRequestConfig & {
    _retry?: boolean;
    _skipAuthRefresh?: boolean;
  };

/* ============================================================
   AUTH STORAGE
============================================================ */

const getStoredAccessToken = (): string | null => {
  try {
    const token =
      localStorage.getItem(
        "access_token"
      );

    if (
      token &&
      token.trim()
    ) {
      return token.trim();
    }
  } catch {
    // Ignore storage errors.
  }

  return null;
};

const getStoredRefreshToken = (): string | null => {
  try {
    const token =
      localStorage.getItem(
        "refresh_token"
      );

    if (
      token &&
      token.trim()
    ) {
      return token.trim();
    }
  } catch {
    // Ignore storage errors.
  }

  return null;
};

const getStoredUser = <T,>(): T | null => {
  try {
    const value =
      localStorage.getItem(
        "user"
      );

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const clearStoredAuth = () => {
  try {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "refresh_token"
    );

    localStorage.removeItem(
      "user"
    );
  } catch {
    // Ignore storage errors.
  }

  delete axios.defaults.headers.common[
    "Authorization"
  ];

  window.dispatchEvent(
    new Event("auth:logout")
  );
};

/* ============================================================
   INITIAL AUTH HEADER
============================================================ */

const initialAccessToken =
  getStoredAccessToken();

if (initialAccessToken) {
  axios.defaults.headers.common[
    "Authorization"
  ] =
    `Bearer ${initialAccessToken}`;
}

/* ============================================================
   REFRESH STATE
============================================================ */

let refreshPromise:
  Promise<string | null> | null = null;

/* ============================================================
   REFRESH ACCESS TOKEN
============================================================ */

const refreshAccessToken =
  async (): Promise<string | null> => {
    const refreshToken =
      getStoredRefreshToken();

    if (!refreshToken) {
      return null;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise =
      (async () => {
        try {
          /*
            IMPORTANT:
            Use axios directly for refresh and explicitly
            disable auth-refresh interception.
          */

          const response =
            await axios.post(
              "/auth/token/refresh/",
              {
                refresh:
                  refreshToken,
              },
              {
                headers: {
                  Authorization: "",
                  "Content-Type":
                    "application/json",
                },

                _skipAuthRefresh:
                  true,
              } as RetryableAxiosConfig
            );

          const newAccessToken =
            response.data?.access ||
            response.data?.data?.access ||
            null;

          const newRefreshToken =
            response.data?.refresh ||
            response.data?.data?.refresh ||
            null;

          if (
            !newAccessToken
          ) {
            throw new Error(
              "Refresh endpoint did not return an access token."
            );
          }

          try {
            localStorage.setItem(
              "access_token",
              newAccessToken
            );

            if (
              newRefreshToken
            ) {
              localStorage.setItem(
                "refresh_token",
                newRefreshToken
              );
            }
          } catch {
            // Ignore storage errors.
          }

          axios.defaults.headers.common[
            "Authorization"
          ] =
            `Bearer ${newAccessToken}`;

          return newAccessToken;
        } catch (error) {
          console.error(
            "Token refresh failed:",
            error
          );

          clearStoredAuth();

          return null;
        } finally {
          refreshPromise =
            null;
        }
      })();

    return refreshPromise;
  };

/* ============================================================
   REQUEST INTERCEPTOR
============================================================ */

axios.interceptors.request.use(
  (
    config: InternalAxiosRequestConfig
  ) => {
    const retryConfig =
      config as RetryableAxiosConfig;

    /*
      Refresh request must not receive the
      normal access token.
    */

    if (
      retryConfig._skipAuthRefresh
    ) {
      return config;
    }

    const token =
      getStoredAccessToken();

    /*
      Always read token from localStorage.
      This guarantees that navigation/reload
      does not lose Authorization.
    */

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }

    /*
      IMPORTANT:
      Do not force JSON for FormData.

      Browser/Axios will automatically generate
      multipart/form-data with its boundary.
    */

    const body =
      config.data;

    const isFormData =
      typeof FormData !==
        "undefined" &&
      body instanceof FormData;

    if (isFormData) {
      /*
        Remove any stale Content-Type.
        Browser will generate the correct header.
      */

      delete config.headers[
        "Content-Type"
      ];
    } else {
      /*
        JSON request.
        Only set it when no content type was
        explicitly provided.
      */

      if (
        !config.headers[
          "Content-Type"
        ]
      ) {
        config.headers[
          "Content-Type"
        ] =
          "application/json";
      }
    }

    return config;
  },

  (error) => {
    return Promise.reject(
      error
    );
  }
);

/* ============================================================
   RESPONSE INTERCEPTOR
============================================================ */

axios.interceptors.response.use(
  (response) => {
    return response;
  },

  async (
    error: AxiosError
  ) => {
    const originalRequest =
      error.config as
        | RetryableAxiosConfig
        | undefined;

    if (!originalRequest) {
      return Promise.reject(
        error
      );
    }

    /*
      Never retry refresh endpoint itself.
    */

    if (
      originalRequest._skipAuthRefresh
    ) {
      return Promise.reject(
        error
      );
    }

    /*
      Only handle 401.
    */

    if (
      error.response?.status !==
      401
    ) {
      return Promise.reject(
        error
      );
    }

    /*
      Prevent infinite retry.
    */

    if (
      originalRequest._retry
    ) {
      clearStoredAuth();

      return Promise.reject(
        error
      );
    }

    originalRequest._retry =
      true;

    const requestUrl =
      originalRequest.url ||
      "";

    /*
      Authentication endpoints should never
      trigger token refresh.
    */

    const authEndpoints = [
      "/auth/login/",
      "/auth/register/",
      "/auth/otp/",
      "/auth/google/",
      "/auth/github/",
      "/auth/token/refresh/",
      "/auth/logout/",
    ];

    const isAuthEndpoint =
      authEndpoints.some(
        (endpoint) =>
          requestUrl.includes(
            endpoint
          )
      );

    if (isAuthEndpoint) {
      return Promise.reject(
        error
      );
    }

    /*
      Attempt refresh.
    */

    const newAccessToken =
      await refreshAccessToken();

    if (
      !newAccessToken
    ) {
      return Promise.reject(
        error
      );
    }

    /*
      Retry original request.
    */

    originalRequest.headers =
      originalRequest.headers ||
      ({} as any);

    originalRequest.headers.Authorization =
      `Bearer ${newAccessToken}`;

    /*
      IMPORTANT:
      Preserve FormData exactly as-is.
      Do not assign Content-Type manually.
    */

    const originalData =
      originalRequest.data;

    const isFormData =
      typeof FormData !==
        "undefined" &&
      originalData instanceof FormData;

    if (isFormData) {
      delete originalRequest.headers[
        "Content-Type"
      ];
    }

    return axios(
      originalRequest
    );
  }
);

/* ============================================================
   THEME CONTEXT
============================================================ */

interface ThemeContextType {
  theme:
    | "light"
    | "dark"
    | "system";

  setTheme: (
    theme:
      | "light"
      | "dark"
      | "system"
  ) => void;

  isDark: boolean;
}

const ThemeContext =
  createContext<ThemeContextType>({
    theme: "system",
    setTheme: () => {},
    isDark: false,
  });

export const useTheme =
  () =>
    useContext(
      ThemeContext
    );

/* ============================================================
   THEME PROVIDER
============================================================ */

const ThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({
  children,
}) => {
  const [
    theme,
    setThemeState,
  ] = useState<
    "light" |
    "dark" |
    "system"
  >(() => {
    try {
      const savedTheme =
        localStorage.getItem(
          "theme"
        );

      if (
        savedTheme ===
          "light" ||
        savedTheme ===
          "dark" ||
        savedTheme ===
          "system"
      ) {
        return savedTheme;
      }
    } catch {
      // Ignore.
    }

    return "system";
  });

  const [
    isDark,
    setIsDark,
  ] = useState(false);

  useEffect(() => {
    const root =
      document.documentElement;

    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

    const applyTheme =
      () => {
        const systemDark =
          mediaQuery.matches;

        const dark =
          theme === "dark" ||
          (
            theme ===
              "system" &&
            systemDark
          );

        setIsDark(dark);

        root.classList.toggle(
          "dark",
          dark
        );

        try {
          localStorage.setItem(
            "theme",
            theme
          );
        } catch {
          // Ignore.
        }
      };

    applyTheme();

    const handleSystemThemeChange =
      () => {
        if (
          theme ===
          "system"
        ) {
          applyTheme();
        }
      };

    mediaQuery.addEventListener(
      "change",
      handleSystemThemeChange
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleSystemThemeChange
      );
    };
  }, [theme]);

  const setTheme =
    useCallback(
      (
        newTheme:
          | "light"
          | "dark"
          | "system"
      ) => {
        setThemeState(
          newTheme
        );
      },
      []
    );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/* ============================================================
   AUTH TYPES
============================================================ */

export interface User {
  id: number;

  email: string;

  name?: string;

  first_name?: string;

  last_name?: string;

  avatar?: string | null;

  is_premium?: boolean;

  plan?: string;
}

interface AuthContextType {
  user: User | null;

  token: string | null;

  isLoading: boolean;

  login: (
    token: string,
    user: User,
    refreshToken?: string
  ) => void;

  logout: () => void;
}

const AuthContext =
  createContext<AuthContextType>({
    user: null,

    token: null,

    isLoading: true,

    login: () => {},

    logout: () => {},
  });

export const useAuth =
  () =>
    useContext(
      AuthContext
    );

/* ============================================================
   AUTH PROVIDER
============================================================ */

const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({
  children,
}) => {
  const [
    token,
    setToken,
  ] = useState<string | null>(
    () =>
      getStoredAccessToken()
  );

  const [
    user,
    setUser,
  ] = useState<User | null>(
    () =>
      getStoredUser<User>()
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  /* ----------------------------------------------------------
     Restore authentication
  ---------------------------------------------------------- */

  useEffect(() => {
    const storedToken =
      getStoredAccessToken();

    const storedUser =
      getStoredUser<User>();

    if (storedToken) {
      axios.defaults.headers.common[
        "Authorization"
      ] =
        `Bearer ${storedToken}`;
    } else {
      delete axios.defaults.headers.common[
        "Authorization"
      ];
    }

    setToken(
      storedToken
    );

    setUser(
      storedUser
    );

    setIsLoading(
      false
    );
  }, []);

  /* ----------------------------------------------------------
     Keep Axios synchronized
  ---------------------------------------------------------- */

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common[
        "Authorization"
      ] =
        `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common[
        "Authorization"
      ];
    }
  }, [token]);

  /* ----------------------------------------------------------
     Login
  ---------------------------------------------------------- */

  const login =
    useCallback(
      (
        newToken: string,
        newUser: User,
        refreshToken?: string
      ) => {
        try {
          localStorage.setItem(
            "access_token",
            newToken
          );

          if (
            refreshToken &&
            refreshToken.trim()
          ) {
            localStorage.setItem(
              "refresh_token",
              refreshToken
            );
          }

          localStorage.setItem(
            "user",
            JSON.stringify(
              newUser
            )
          );
        } catch {
          // Ignore storage errors.
        }

        setToken(
          newToken
        );

        setUser(
          newUser
        );

        axios.defaults.headers.common[
          "Authorization"
        ] =
          `Bearer ${newToken}`;
      },
      []
    );

  /* ----------------------------------------------------------
     Logout
  ---------------------------------------------------------- */

  const logout =
    useCallback(
      () => {
        clearStoredAuth();

        setToken(
          null
        );

        setUser(
          null
        );
      },
      []
    );

  /* ----------------------------------------------------------
     Auth logout event
  ---------------------------------------------------------- */

  useEffect(() => {
    const handleAuthLogout =
      () => {
        setToken(
          null
        );

        setUser(
          null
        );

        delete axios.defaults.headers.common[
          "Authorization"
        ];
      };

    window.addEventListener(
      "auth:logout",
      handleAuthLogout
    );

    return () => {
      window.removeEventListener(
        "auth:logout",
        handleAuthLogout
      );
    };
  }, []);

  /* ----------------------------------------------------------
     Cross-tab synchronization
  ---------------------------------------------------------- */

  useEffect(() => {
    const syncAuth =
      () => {
        const storedToken =
          getStoredAccessToken();

        const storedUser =
          getStoredUser<User>();

        setToken(
          storedToken
        );

        setUser(
          storedUser
        );

        if (storedToken) {
          axios.defaults.headers.common[
            "Authorization"
          ] =
            `Bearer ${storedToken}`;
        } else {
          delete axios.defaults.headers.common[
            "Authorization"
          ];
        }
      };

    window.addEventListener(
      "storage",
      syncAuth
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncAuth
      );
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ============================================================
   PROTECTED ROUTE
============================================================ */

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
}> = ({
  children,
}) => {
  const {
    token,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen />
    );
  }

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <>
      {children}
    </>
  );
};

/* ============================================================
   LAZY IMPORTS
============================================================ */

const LoginPage =
  React.lazy(
    () =>
      import(
        "./pages/LoginPage"
      )
  );

const RegisterPage =
  React.lazy(
    () =>
      import(
        "./pages/RegisterPage"
      )
  );

const DashboardPage =
  React.lazy(
    () =>
      import(
        "./pages/DashboardPage"
      )
  );

const TranslatePage =
  React.lazy(
    () =>
      import(
        "./pages/TranslatePage"
      )
  );

const ToolsPage =
  React.lazy(
    () =>
      import(
        "./pages/ToolsPage"
      )
  );

const DocumentsPage =
  React.lazy(
    () =>
      import(
        "./pages/DocumentsPage"
      )
  );

const HistoryPage =
  React.lazy(
    () =>
      import(
        "./pages/HistoryPage"
      )
  );

const CombinePage =
  React.lazy(
    () =>
      import(
        "./pages/CombinePage"
      )
  );

const AboutPage =
  React.lazy(
    () =>
      import(
        "./pages/AboutPage"
      )
  );

const SettingsPage =
  React.lazy(
    () =>
      import(
        "./pages/SettingsPage"
      )
  );

const Layout =
  React.lazy(
    () =>
      import(
        "./components/Layout"
      )
  );

/* ============================================================
   REACT QUERY
============================================================ */

const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus:
          false,
      },

      mutations: {
        retry: 0,
      },
    },
  });

/* ============================================================
   APP
============================================================ */

const App: React.FC = () => {
  return (
    <QueryClientProvider
      client={
        queryClient
      }
    >
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                className:
                  "dark:bg-slate-800 dark:text-white",

                duration: 4000,
              }}
            />

            <React.Suspense
              fallback={
                <LoadingScreen />
              }
            >
              <Routes>

                {/* =================================================
                    PUBLIC
                ================================================== */}

                <Route
                  path="/login"
                  element={
                    <LoginPage />
                  }
                />

                <Route
                  path="/register"
                  element={
                    <RegisterPage />
                  }
                />

                {/* =================================================
                    PROTECTED
                ================================================== */}

                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    path="/"
                    element={
                      <DashboardPage />
                    }
                  />

                  <Route
                    path="/dashboard"
                    element={
                      <DashboardPage />
                    }
                  />

                  <Route
                    path="/translate"
                    element={
                      <TranslatePage />
                    }
                  />

                  <Route
                    path="/tools"
                    element={
                      <ToolsPage />
                    }
                  />

                  <Route
                    path="/documents"
                    element={
                      <DocumentsPage />
                    }
                  />

                  <Route
                    path="/history"
                    element={
                      <HistoryPage />
                    }
                  />

                  <Route
                    path="/combine"
                    element={
                      <CombinePage />
                    }
                  />

                  <Route
                    path="/about"
                    element={
                      <AboutPage />
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <SettingsPage />
                    }
                  />
                </Route>

                {/* =================================================
                    FALLBACK
                ================================================== */}

                <Route
                  path="*"
                  element={
                    <Navigate
                      to="/"
                      replace
                    />
                  }
                />

              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

/* ============================================================
   LOADING SCREEN
============================================================ */

const LoadingScreen: React.FC =
  () => {
    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-gradient-to-br
          from-primary-50
          to-accent-purple/10
          dark:from-dark-bg
          dark:to-slate-900
          transition-colors
          duration-300
        "
      >
        <div
          className="
            flex
            flex-col
            items-center
            gap-4
          "
        >
          <div
            className="
              w-12
              h-12
              border-4
              border-primary-200
              dark:border-primary-800
              border-t-primary-600
              rounded-full
              animate-spin
            "
          />

          <p
            className="
              text-slate-500
              dark:text-slate-400
              font-medium
            "
          >
            Loading quill...
          </p>
        </div>
      </div>
    );
  };

export default App;

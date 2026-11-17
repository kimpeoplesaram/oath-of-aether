import { useState } from "react";
import { JOBS } from "../data/jobs";
import { ApiError, login, register, wsUrlToHttp, normalizeServerUrl } from "../multiplayer/accountApi";
import type { AccountPayload } from "../multiplayer/accountApi";
import type { AccountSession, JobId } from "../types";

interface Props {
  onLoggedIn: (session: AccountSession, account: AccountPayload, wsServerUrl: string) => void;
  onBack: () => void;
}

type Tab = "login" | "register";

// 배포된 공식 서버 주소. 로컬(localhost)에서 개발 중일 때는 로컬 서버를 기본값으로 쓴다.
const PRODUCTION_SERVER_URL = "wss://oath-of-aether.onrender.com";
const LOCAL_SERVER_URL = "ws://localhost:8787";
const DEFAULT_SERVER_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? LOCAL_SERVER_URL
    : PRODUCTION_SERVER_URL;

export function LoginScreen({ onLoggedIn, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>(JOBS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginFailed, setLoginFailed] = useState(false);

  const canSubmitLogin = username.trim().length > 0 && password.length > 0 && serverUrl.trim().length > 0;
  const canSubmitRegister = canSubmitLogin && name.trim().length > 0;

  async function handleLogin() {
    setError(null);
    setLoginFailed(false);
    setBusy(true);
    try {
      const normalized = normalizeServerUrl(serverUrl);
      const apiBaseUrl = wsUrlToHttp(normalized);
      const { token, account } = await login(apiBaseUrl, { username: username.trim(), password });
      onLoggedIn({ username: account.username, token, apiBaseUrl, guildId: account.guildId }, account, normalized);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
      setLoginFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setError(null);
    setLoginFailed(false);
    setBusy(true);
    try {
      const normalized = normalizeServerUrl(serverUrl);
      const apiBaseUrl = wsUrlToHttp(normalized);
      const { token, account } = await register(apiBaseUrl, {
        username: username.trim(),
        password,
        name: name.trim(),
        jobId,
      });
      onLoggedIn({ username: account.username, token, apiBaseUrl, guildId: account.guildId }, account, normalized);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-hero">
      <div className="login-hero-side">
        <h1 className="title-font login-hero-title">에테르의 서약</h1>
        <p className="login-hero-tagline">타자로 베고, 타자로 피하라.</p>
        <p className="login-hero-desc">
          계정을 만들면 캐릭터 성장과 장비, 길드 가입 정보가 서버에 저장되어
          다음에 다시 접속해도 이어서 플레이할 수 있어요. 친구와 같은 방 코드로
          접속하면 함께 던전에 도전할 수 있습니다.
        </p>
        <div className="login-hero-jobs">
          {JOBS.map((job) => (
            <span key={job.id} className="login-hero-job-chip">
              {job.icon} {job.name}
            </span>
          ))}
        </div>
      </div>

      <div className="panel login-screen">
        <div className="login-tabs">
          <button className={`login-tab${tab === "login" ? " active" : ""}`} onClick={() => setTab("login")}>
            로그인
          </button>
          <button className={`login-tab${tab === "register" ? " active" : ""}`} onClick={() => setTab("register")}>
            회원가입
          </button>
        </div>

        <input
          className="name-input"
          placeholder="아이디 (영문/숫자/밑줄 3~20자)"
          value={username}
          onChange={(e: any) => setUsername(e.target.value)}
        />
        <input
          className="name-input"
          type="password"
          placeholder="비밀번호 (4자 이상)"
          value={password}
          onChange={(e: any) => setPassword(e.target.value)}
        />

        {tab === "register" && (
          <>
            <input
              className="name-input"
              placeholder="모험가 이름"
              value={name}
              maxLength={12}
              onChange={(e: any) => setName(e.target.value)}
            />
            <div className="job-grid small">
              {JOBS.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className={`job-card${job.id === jobId ? " selected" : ""}`}
                  onClick={() => setJobId(job.id)}
                >
                  <div className="job-icon">{job.icon}</div>
                  <h3>{job.name}</h3>
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="login-error">
            {error}
            {tab === "login" && loginFailed && (
              <>
                {" "}
                <button
                  type="button"
                  className="login-error-link"
                  onClick={() => {
                    setTab("register");
                    setError(null);
                    setLoginFailed(false);
                  }}
                >
                  계정이 없으신가요? 회원가입
                </button>
              </>
            )}
          </p>
        )}

        <div className="row-actions">
          <button className="btn-secondary" onClick={onBack} disabled={busy}>
            뒤로
          </button>
          {tab === "login" ? (
            <button className="btn-primary" disabled={!canSubmitLogin || busy} onClick={handleLogin}>
              {busy ? "로그인 중..." : "로그인"}
            </button>
          ) : (
            <button className="btn-primary" disabled={!canSubmitRegister || busy} onClick={handleRegister}>
              {busy ? "가입 중..." : "회원가입"}
            </button>
          )}
        </div>

        <button
          type="button"
          className="login-advanced-toggle"
          onClick={() => setShowServerSettings((v) => !v)}
        >
          {showServerSettings ? "서버 설정 숨기기" : "서버 설정 (고급)"}
        </button>
        {showServerSettings && (
          <input
            className="name-input"
            placeholder="서버 주소 (예: wss://oath-of-aether.onrender.com)"
            value={serverUrl}
            onChange={(e: any) => setServerUrl(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { JOBS } from "../data/jobs";
import { ApiError, login, register, wsUrlToHttp } from "../multiplayer/accountApi";
import type { AccountPayload } from "../multiplayer/accountApi";
import type { AccountSession, JobId } from "../types";

interface Props {
  onLoggedIn: (session: AccountSession, account: AccountPayload, wsServerUrl: string) => void;
  onBack: () => void;
}

type Tab = "login" | "register";

export function LoginScreen({ onLoggedIn, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [serverUrl, setServerUrl] = useState("ws://localhost:8787");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>(JOBS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitLogin = username.trim().length > 0 && password.length > 0 && serverUrl.trim().length > 0;
  const canSubmitRegister = canSubmitLogin && name.trim().length > 0;

  async function handleLogin() {
    setError(null);
    setBusy(true);
    try {
      const apiBaseUrl = wsUrlToHttp(serverUrl.trim());
      const { token, account } = await login(apiBaseUrl, { username: username.trim(), password });
      onLoggedIn({ username: account.username, token, apiBaseUrl, guildId: account.guildId }, account, serverUrl.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setError(null);
    setBusy(true);
    try {
      const apiBaseUrl = wsUrlToHttp(serverUrl.trim());
      const { token, account } = await register(apiBaseUrl, {
        username: username.trim(),
        password,
        name: name.trim(),
        jobId,
      });
      onLoggedIn({ username: account.username, token, apiBaseUrl, guildId: account.guildId }, account, serverUrl.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel login-screen">
      <h2 className="title-font">계정으로 시작하기</h2>
      <p className="login-hint">
        계정은 캐릭터와 성장 정보를 서버에 저장합니다. 길드 기능도 로그인한 계정으로만 이용할 수 있어요.
      </p>

      <input
        className="name-input"
        placeholder="서버 주소 (예: ws://localhost:8787)"
        value={serverUrl}
        onChange={(e: any) => setServerUrl(e.target.value)}
      />

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

      {error && <p className="login-error">{error}</p>}

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
    </div>
  );
}

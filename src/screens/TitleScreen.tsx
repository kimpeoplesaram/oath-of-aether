interface Props {
  onStart: () => void;
  onLogin: () => void;
}

export function TitleScreen({ onStart, onLogin }: Props) {
  return (
    <div className="panel title-screen">
      <div className="ether-rune">◈</div>
      <h1 className="title-font">에테르의 서약</h1>
      <div className="subtitle">The Oath of Aether</div>
      <div className="title-actions">
        <button className="btn-primary" onClick={onStart}>
          게스트로 시작하기
        </button>
        <button className="btn-secondary" onClick={onLogin}>
          계정으로 로그인 / 회원가입
        </button>
      </div>
    </div>
  );
}

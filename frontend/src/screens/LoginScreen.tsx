import { useState } from "react";
import mascot from "../assets/mascot.svg";

export function LoginScreen({
  isLoading,
  errorMessage,
  onLogin,
  onGuestLogin,
  isGuestLoading
}: {
  isLoading: boolean;
  errorMessage: string;
  onLogin: (email: string) => void;
  onGuestLogin: () => void;
  isGuestLoading: boolean;
}) {
  const [email, setEmail] = useState("");

  return (
    <section className="home-hero login-hero">
      <div className="home-copy">
        <img src={mascot} alt="" width={56} height={56} />
        <h1>ログイン</h1>
        <p>事前に登録されたメールアドレスでログインしてください。</p>
      </div>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) onLogin(email.trim());
        }}
      >
        <input
          className="participant-input"
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
        {errorMessage && <p className="login-error">{errorMessage}</p>}
        <button className="button primary" type="submit" disabled={isLoading}>
          {isLoading ? "確認中..." : "ログイン"}
        </button>
      </form>
      <button className="button secondary" type="button" disabled={isGuestLoading} onClick={onGuestLogin}>
        {isGuestLoading ? "準備中..." : "ゲストとして試す"}
      </button>
      <p className="login-guest-note">ゲストモードでは会話履歴・記憶はサーバーに保存されません。</p>
    </section>
  );
}

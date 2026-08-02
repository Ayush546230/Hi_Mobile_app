import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Welcome banner */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', padding: '28px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--gold)' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontFamily: 'var(--font-display)' }}>
                  {user?.name?.[0] || user?.email?.[0] || '?'}
                </div>
              )}
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--white)', marginBottom: 2 }}>
                  Welcome, {user?.name?.split(' ')[0] || 'there'}!
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                  {user?.email} · Signed in via{' '}
                  <span style={{ color: 'var(--gold)' }}>
                    {user?.lastLoginMethod === 'passkey' ? 'Passkey' : user?.lastLoginMethod === 'push' ? 'Push' : 'Google'}
                  </span>
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--white)', color: 'var(--white)' }} onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '40px 0 80px' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="card animate-fade-up">
            <h3 style={{ fontSize: 22, fontFamily: 'var(--font-display)', marginBottom: 12 }}>Social Login</h3>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.8 }}>
              Social login allows users to authenticate using their existing accounts from providers like Google. When you click "Sign in with Google", your browser communicates with Google's Identity Services. Google verifies your identity and issues a secure, signed token (JWT) to our application. Our backend verifies this token's signature using Google's public keys. This ensures that you are who you say you are without us ever needing to see or store your password.
            </p>
          </div>

          <div className="card animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h3 style={{ fontSize: 22, fontFamily: 'var(--font-display)', marginBottom: 12 }}>Passkeys Step-by-Step Working</h3>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.8, marginBottom: 16 }}>
              Passkeys replace passwords with biometric authentication (like FaceID, TouchID, or Windows Hello) using public-key cryptography. Here is how they work:
            </p>
            <ol style={{ paddingLeft: 20, fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.8, margin: 0 }}>
              <li><strong>Registration:</strong> Your device generates a unique public-private key pair. The public key is sent to our server, while the private key never leaves your device's secure hardware.</li>
              <li><strong>Challenge:</strong> When you attempt to sign in, our server sends a random "challenge" to your device.</li>
              <li><strong>Verification:</strong> Your device prompts you for a biometric check. Once verified, it signs the challenge with your private key.</li>
              <li><strong>Authentication:</strong> The signed challenge is sent back to our server, which uses your previously stored public key to verify the signature. If it matches, you are securely logged in.</li>
            </ol>
          </div>

          {/* ─── Push Notification Auth Card ──────────── */}
          <div className="card animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h3 style={{ fontSize: 22, fontFamily: 'var(--font-display)', margin: 0 }}>Frictionless Single Click Login</h3>
              <span className="badge badge-green">Zero-Setup Active</span>
            </div>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.8, marginBottom: 16 }}>
              Our Push Notification authentication is fully zero-setup. You do not need to enable, verify, or register anything here. The first time you click "Login with Single Click" on the login page, the system automatically registers a push notification channel with your device on-the-fly and sends you a popup notification request immediately.
            </p>
            
            <div style={{ padding: '16px', background: 'var(--cream)', borderRadius: 8, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>How the Zero-Setup magic works:</h4>
              <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.8, margin: 0 }}>
                <li>On the login page, click <strong>Login with Single Click</strong></li>
                <li>Allow browser notifications if prompted</li>
                <li>A popup notification is instantly pushed to your desktop or mobile OS saying: <em>"someone wants to login into system"</em></li>
                <li>Tap <strong>Allow</strong> directly on the notification to sign in instantly! No webpage redirects, no passwords, no hassle.</li>
              </ol>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

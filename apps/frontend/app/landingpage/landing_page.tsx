"use client";
import React, { useEffect, useRef, useState } from "react";

type PageName = "landing" | "login" | "signup";

const GAUGE_CIRCUMFERENCE = 628;
const GAUGE_FILL_PERCENT = 0.68;

const PAGE_MARKUP: string = `
<!-- ============ SHARED NAV ============ -->
<nav>
  <div class="logo" data-page="landing">
    <div class="logo-mark"></div>
    LPG Guardian<span class="logo-sub">Vigilant Monitoring</span>
  </div>
  <div class="nav-links" id="navLinks">
    <a href="#how">How it works</a>
    <a href="#features">Features</a>
    <a href="#providers">Providers</a>
    <a href="#pricing">Pricing</a>
  </div>
  <div class="nav-cta">
    <a class="ghost" data-page="login">Log in</a>
    <a class="btn btn-flame" data-page="signup">Get started</a>
  </div>
</nav>

<!-- ============ LANDING PAGE ============ -->
<div class="page active" id="page-landing">

  <header class="hero">
    <div>
      <div class="eyebrow"><span class="dot"></span>Live sensor network · 24/7 monitoring</div>
      <h1>Know your gas level<br>before the flame <span class="accent">goes out.</span></h1>
      <p class="lede">LPG Guardian clips onto any cylinder and reads pressure, weight, and flow in real time — so leaks get caught in minutes, refills happen before you run dry, and nobody has to shake a tank to guess.</p>
      <div class="hero-actions">
        <a class="btn btn-flame btn-lg" data-page="signup">Start monitoring free</a>
        <a class="btn btn-outline btn-lg" href="#how">See how it works</a>
      </div>
      <div class="trust-row">
        <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>Leak alerts in under 90 seconds</div>
        <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Works with any regulator</div>
      </div>
    </div>

    <div class="gauge-wrap">
      <div class="gauge-card">
        <div class="gauge-card-head">
          <span class="tag">Tank #01 · Kitchen Main</span>
          <span class="live">Live</span>
        </div>
        <div class="gauge-ring">
          <svg viewBox="0 0 220 220">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#33D6A6"/>
                <stop offset="100%" stop-color="#7FE8C9"/>
              </linearGradient>
            </defs>
            <circle class="track" cx="110" cy="110" r="100"/>
            <circle class="fill" id="gaugeFill" cx="110" cy="110" r="100"/>
          </svg>
          <div class="gauge-center">
            <div class="pct">68%</div>
            <div class="lbl">Optimal pressure</div>
          </div>
        </div>
        <div class="gauge-stats">
          <div class="gauge-stat"><div class="n">18 days</div><div class="l">Est. remaining</div></div>
          <div class="gauge-stat"><div class="n">8.2 bar</div><div class="l">Line pressure</div></div>
        </div>
      </div>
      <div class="float-alert">
        <div class="ic">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#33D6A6" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div class="txt"><b>Daily leak check clear</b><span>No leaks detected · 2m ago</span></div>
      </div>
    </div>
  </header>

  <div class="strip">
    <div class="strip-item"><div class="n">14,200+</div><div class="l">Cylinders monitored</div></div>
    <div class="strip-item"><div class="n">&lt; 90s</div><div class="l">Avg. leak alert time</div></div>
    <div class="strip-item"><div class="n">99.4%</div><div class="l">Sensor uptime</div></div>
    <div class="strip-item"><div class="n">312</div><div class="l">Partner service providers</div></div>
  </div>

  <section id="how">
    <div class="section-head">
      <div class="eyebrow-line">How it works</div>
      <h2>From cylinder to phone in three steps.</h2>
      <p>One sensor, clipped to your existing tank, does the rest — no plumbing changes, no new hardware to install on the stove.</p>
    </div>
    <div class="flow">
      <div class="flow-step">
        <div class="num">01 / SENSE</div>
        <h3>Clip on the sensor</h3>
        <p>A magnetic weight-and-pressure sensor attaches to any standard cylinder in under two minutes — no tools required.</p>
        <div class="arrow">→</div>
      </div>
      <div class="flow-step">
        <div class="num">02 / READ</div>
        <h3>Guardian reads continuously</h3>
        <p>Weight, pressure, and flow rate are sampled every few seconds and checked against your household's usage pattern.</p>
        <div class="arrow">→</div>
      </div>
      <div class="flow-step">
        <div class="num">03 / ACT</div>
        <h3>You get told what to do</h3>
        <p>A low-level warning, a leak alert, or a one-tap refill request — sent before the problem reaches your stove.</p>
      </div>
    </div>
  </section>

  <section id="features">
    <div class="section-head">
      <div class="eyebrow-line">Features</div>
      <h2>Everything the dashboard shows, and nothing it hides.</h2>
      <p>Built around the four things gas customers actually worry about: running out, leaking, paying too much, and not knowing who to call.</p>
    </div>
    <div class="features">
      <div class="feature">
        <div class="ic" style="background:var(--safe-dim)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#33D6A6" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg></div>
        <h3>Leak &amp; anomaly detection</h3>
        <p>Sudden flow spikes or pressure drops trigger an emergency shutdown prompt and a call-support shortcut, day or night.</p>
      </div>
      <div class="feature">
        <div class="ic" style="background:var(--flame-dim)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF8A3D" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-6"/></svg></div>
        <h3>Consumption analytics</h3>
        <p>See exactly where gas goes — cooking, water heating, or standby loss — and get a monthly report that flags waste.</p>
      </div>
      <div class="feature">
        <div class="ic" style="background:rgba(255,255,255,0.06)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F3F1EA" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3l0 4M8 3l0 4"/></svg></div>
        <h3>Predictive refill scheduling</h3>
        <p>Guardian forecasts your empty date from real usage, not a fixed calendar, and can request a refill automatically.</p>
      </div>
      <div class="feature">
        <div class="ic" style="background:rgba(255,255,255,0.06)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F3F1EA" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <h3>Service provider marketplace</h3>
        <p>Compare local suppliers by price, response time, and rating, and switch providers without losing your history.</p>
      </div>
    </div>
  </section>

  <section id="providers">
    <div class="section-head">
      <div class="eyebrow-line">Dashboard</div>
      <h2>The view you'll actually check every morning.</h2>
      <p>A single screen for tank level, alerts, and the people you'd call if something looked wrong.</p>
    </div>
    <div class="preview-wrap">
      <div class="preview">
        <div class="preview-card">
          <h4>30-day usage</h4>
          <div class="bar-chart">
            <div style="height:40%"></div><div style="height:55%"></div><div style="height:30%"></div>
            <div style="height:70%"></div><div style="height:45%"></div><div style="height:85%"></div>
            <div style="height:38%"></div><div style="height:60%"></div><div style="height:50%"></div>
            <div style="height:72%"></div><div style="height:33%"></div><div style="height:64%"></div>
          </div>
        </div>
        <div class="preview-card">
          <h4>Notifications</h4>
          <div class="alert-row">
            <div class="dot" style="background:var(--alert)"></div>
            <div class="body"><b>Low gas — Tank #02</b><span>Below 15%, ~2 days remaining</span></div>
            <span class="chip chip-alert">Critical</span>
          </div>
          <div class="alert-row">
            <div class="dot" style="background:var(--safe)"></div>
            <div class="body"><b>Refill complete — Tank #01</b><span>Backup_Gen refilled to 100%</span></div>
            <span class="chip chip-safe">Resolved</span>
          </div>
          <div class="alert-row">
            <div class="dot" style="background:var(--muted-2)"></div>
            <div class="body"><b>Monthly report ready</b><span>Consumption up 12% vs. April</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <div class="cta-band">
    <div>
      <h2>Your first sensor ships free with any plan.</h2>
      <p class="sub">Set up in two minutes. Cancel any time — the sensor's yours to keep.</p>
    </div>
    <a class="btn btn-flame btn-lg" data-page="signup">Create your account</a>
  </div>

  <footer>
    <div class="footer-top">
      <div class="logo" style="margin-bottom:0;" data-page="landing">
        <div class="logo-mark"></div>LPG Guardian
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h5>Product</h5>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div class="footer-col">
          <h5>Company</h5>
          <a href="#">About</a>
          <a href="#">Service providers</a>
          <a href="#">Support</a>
        </div>
        <div class="footer-col">
          <h5>Account</h5>
          <a data-page="login">Log in</a>
          <a data-page="signup">Sign up</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 LPG Guardian. All systems normal.</span>
      <span>Terms of Service · Privacy Policy · Contact Support</span>
    </div>
  </footer>
</div>

<!-- ============ LOGIN PAGE ============ -->
<div class="page" id="page-login">
  <div class="auth-shell">
    <div class="auth-visual">
      <div class="logo" data-page="landing"><div class="logo-mark"></div>LPG Guardian</div>
      <div class="mini-gauge">
        <div class="row"><div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#33D6A6" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div><div><b>Daily leak check clear</b><span>No leaks detected on any tank</span></div></div>
        <div class="row"><div class="ic" style="background:var(--flame-dim)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF8A3D" stroke-width="2.2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg></div><div><b>18 days to refill</b><span>Kitchen Main is holding steady at 68%</span></div></div>
      </div>
      <div class="quote">
        <p>"I stopped shaking cylinders in the dark to guess how much was left. Guardian just tells me."</p>
        <div class="who"><b>Amara N.</b> — Household Admin, Kampala</div>
      </div>
    </div>
    <div class="auth-form-side">
      <div class="auth-form">
        <a class="back" data-page="landing">← Back to site</a>
        <h1>Welcome back</h1>
        <p class="sub">Log in to check your tank levels and alerts.</p>

        <div class="field"><label>Email address</label><input type="email" placeholder="you@example.com"></div>
        <div class="field"><label>Password</label><input type="password" placeholder="••••••••••"></div>
        <div class="field-inline">
          <label class="checkbox"><input type="checkbox">Keep me signed in</label>
          <a href="#">Forgot password?</a>
        </div>
        <a class="btn btn-flame btn-lg btn-block" data-page="landing">Log in</a>

        <div class="divider">OR</div>
        <div class="oauth-row">
          <div class="oauth-btn"><svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z"/></svg>Google</div>
          <div class="oauth-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="#F3F1EA"><path d="M17.6 13.2c0-2.8 2.3-4.2 2.4-4.2-1.3-1.9-3.3-2.2-4-2.2-1.7-.2-3.3 1-4.2 1-.9 0-2.2-1-3.6-1-1.9 0-3.6 1.1-4.6 2.8-2 3.4-.5 8.5 1.4 11.3.9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9s2.1.9 3.6.9c1.5 0 2.4-1.4 3.3-2.7 1.1-1.6 1.5-3.1 1.5-3.2-.1 0-2.9-1.1-2.9-4.6zM14.9 4.6c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z"/></svg>Apple</div>
        </div>
        <p class="switch-line">New to LPG Guardian? <a data-page="signup">Create an account</a></p>
      </div>
    </div>
  </div>
</div>

<!-- ============ SIGNUP PAGE ============ -->
<div class="page" id="page-signup">
  <div class="auth-shell">
    <div class="auth-visual">
      <div class="logo" data-page="landing"><div class="logo-mark"></div>LPG Guardian</div>
      <div class="mini-gauge">
        <div class="row"><div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#33D6A6" stroke-width="2.4"><path d="M12 20V10M18 20V4M6 20v-6"/></svg></div><div><b>Free sensor with sign-up</b><span>Ships within 3–5 business days</span></div></div>
        <div class="row"><div class="ic" style="background:rgba(255,255,255,0.06)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F3F1EA" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg></div><div><b>Two-minute setup</b><span>No tools, no plumbing changes</span></div></div>
      </div>
      <div class="quote">
        <p>"Set it up on a Sunday morning. By that afternoon it caught a slow leak I'd never have noticed."</p>
        <div class="who"><b>James W.</b> — Premium Member, Austin</div>
      </div>
    </div>
    <div class="auth-form-side">
      <div class="auth-form">
        <a class="back" data-page="landing">← Back to site</a>
        <h1>Create your account</h1>
        <p class="sub">Start monitoring your first cylinder in minutes.</p>

        <div class="field-row">
          <div class="field"><label>First name</label><input type="text" placeholder="John"></div>
          <div class="field"><label>Last name</label><input type="text" placeholder="Doe"></div>
        </div>
        <div class="field"><label>Email address</label><input type="email" placeholder="you@example.com"></div>
        <div class="field"><label>Phone number</label><input type="tel" placeholder="+256 700 123 456"></div>
        <div class="field"><label>Password</label><input type="password" placeholder="Create a password"></div>

        <a class="btn btn-flame btn-lg btn-block" data-page="landing">Create account</a>

        <div class="divider">OR</div>
        <div class="oauth-row">
          <div class="oauth-btn"><svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z"/></svg>Google</div>
          <div class="oauth-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="#F3F1EA"><path d="M17.6 13.2c0-2.8 2.3-4.2 2.4-4.2-1.3-1.9-3.3-2.2-4-2.2-1.7-.2-3.3 1-4.2 1-.9 0-2.2-1-3.6-1-1.9 0-3.6 1.1-4.6 2.8-2 3.4-.5 8.5 1.4 11.3.9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9s2.1.9 3.6.9c1.5 0 2.4-1.4 3.3-2.7 1.1-1.6 1.5-3.1 1.5-3.2-.1 0-2.9-1.1-2.9-4.6zM14.9 4.6c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z"/></svg>Apple</div>
        </div>
        <p class="terms">By creating an account you agree to Guardian's <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
        <p class="switch-line">Already have an account? <a data-page="login">Log in</a></p>
      </div>
    </div>
  </div>
</div>
`;

const STYLES: string = `

  :root{
    --ink:#0A1424;
    --panel:#101F3B;
    --panel-2:#152A4E;
    --line:rgba(226,232,245,0.10);
    --line-strong:rgba(226,232,245,0.18);
    --paper:#F3F1EA;
    --muted:#8C96AD;
    --muted-2:#5E6885;
    --flame:#FF8A3D;
    --flame-dim:#FF8A3D33;
    --safe:#33D6A6;
    --safe-dim:#33D6A61F;
    --alert:#FF5A5F;
    --alert-dim:#FF5A5F1F;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    background:var(--ink);
    color:var(--paper);
    font-family:'Inter',sans-serif;
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }
  ::selection{background:var(--flame);color:var(--ink);}
  a{color:inherit;text-decoration:none;}
  .mono{font-family:'JetBrains Mono',monospace;}
  .display{font-family:'Space Grotesk',sans-serif;}
  button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;}
  input{font-family:inherit;}

  /* background texture */
  body::before{
    content:'';
    position:fixed;inset:0;
    background:
      radial-gradient(ellipse 800px 500px at 85% -5%, rgba(255,138,61,0.10), transparent 60%),
      radial-gradient(ellipse 700px 500px at -10% 20%, rgba(51,214,166,0.06), transparent 60%);
    pointer-events:none;
    z-index:0;
  }

  .page{display:none;}
  .page.active{display:block;}

  /* ---------- NAV ---------- */
  nav{
    position:fixed;top:0;left:0;right:0;z-index:100;
    display:flex;align-items:center;justify-content:space-between;
    padding:22px 48px;
    background:rgba(10,20,36,0.72);
    backdrop-filter:blur(14px);
    border-bottom:1px solid var(--line);
  }
  .logo{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;letter-spacing:0.01em;cursor:pointer;}
  .logo-mark{
    width:30px;height:30px;border-radius:8px;
    background:linear-gradient(145deg,var(--flame),#E0632A);
    display:flex;align-items:center;justify-content:center;
    position:relative;flex-shrink:0;
  }
  .logo-mark::after{
    content:'';width:9px;height:9px;border-radius:50%;
    background:var(--ink);
    box-shadow:0 0 0 2px rgba(10,20,36,0.3) inset;
  }
  .logo-sub{color:var(--muted);font-weight:400;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;margin-left:2px;}
  .nav-links{display:flex;gap:36px;font-size:14px;color:var(--muted);}
  .nav-links a{transition:color .2s;}
  .nav-links a:hover{color:var(--paper);}
  .nav-cta{display:flex;align-items:center;gap:20px;}
  .nav-cta .ghost{font-size:14px;color:var(--muted);transition:color .2s;}
  .nav-cta .ghost:hover{color:var(--paper);}
  .btn{
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;
    transition:transform .15s ease, box-shadow .2s ease, background .2s ease;
  }
  .btn-flame{background:var(--flame);color:#1A0D02;}
  .btn-flame:hover{transform:translateY(-1px);box-shadow:0 8px 24px -8px rgba(255,138,61,0.6);}
  .btn-outline{border:1px solid var(--line-strong);color:var(--paper);}
  .btn-outline:hover{border-color:var(--flame);background:rgba(255,138,61,0.06);}
  .btn-block{width:100%;}

  /* ---------- HERO ---------- */
  header.hero{
    position:relative;z-index:1;
    padding:190px 48px 110px;
    display:grid;grid-template-columns:1.05fr 0.95fr;gap:60px;
    max-width:1280px;margin:0 auto;
    align-items:center;
  }
  .eyebrow{
    display:inline-flex;align-items:center;gap:8px;
    font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:0.08em;
    color:var(--safe);background:var(--safe-dim);border:1px solid rgba(51,214,166,0.25);
    padding:6px 12px;border-radius:100px;margin-bottom:26px;text-transform:uppercase;
  }
  .eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--safe);animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.35;}}
  h1{
    font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:clamp(38px,4.6vw,60px);line-height:1.04;letter-spacing:-0.02em;
    margin-bottom:24px;
  }
  h1 .accent{color:var(--flame);font-style:italic;font-weight:500;}
  .hero p.lede{font-size:17px;line-height:1.65;color:var(--muted);max-width:480px;margin-bottom:36px;}
  .hero-actions{display:flex;gap:14px;align-items:center;margin-bottom:44px;}
  .btn-lg{padding:15px 26px;font-size:15px;border-radius:9px;}
  .trust-row{display:flex;gap:28px;color:var(--muted-2);font-size:12.5px;}
  .trust-row div{display:flex;align-items:center;gap:8px;}
  .trust-row svg{opacity:0.7;}

  /* gauge visual */
  .gauge-wrap{position:relative;display:flex;justify-content:center;align-items:center;}
  .gauge-card{
    background:linear-gradient(160deg,var(--panel),var(--panel-2));
    border:1px solid var(--line-strong);
    border-radius:20px;padding:32px;width:100%;max-width:400px;
    box-shadow:0 40px 80px -30px rgba(0,0,0,0.6);
    position:relative;
  }
  .gauge-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;}
  .gauge-card-head span.tag{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;}
  .gauge-card-head span.live{display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--safe);}
  .gauge-card-head span.live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);animation:pulse 2s infinite;}
  .gauge-ring{position:relative;width:220px;height:220px;margin:0 auto 22px;}
  .gauge-ring svg{transform:rotate(-90deg);width:100%;height:100%;}
  .gauge-ring .track{fill:none;stroke:rgba(255,255,255,0.06);stroke-width:10;}
  .gauge-ring .fill{fill:none;stroke:url(#gaugeGrad);stroke-width:10;stroke-linecap:round;stroke-dasharray:628;stroke-dashoffset:200;transition:stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1);}
  .gauge-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .gauge-center .pct{font-family:'Space Grotesk',sans-serif;font-size:44px;font-weight:700;}
  .gauge-center .lbl{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;}
  .gauge-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .gauge-stat{background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:10px;padding:12px 14px;}
  .gauge-stat .n{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:600;}
  .gauge-stat .l{font-size:10.5px;color:var(--muted);margin-top:3px;letter-spacing:0.02em;}
  .float-alert{
    position:absolute;bottom:-18px;left:-18px;
    background:var(--panel-2);border:1px solid var(--line-strong);
    border-radius:12px;padding:12px 16px;display:flex;gap:10px;align-items:center;
    box-shadow:0 20px 40px -14px rgba(0,0,0,0.55);
    max-width:230px;
    animation:float 4s ease-in-out infinite;
  }
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
  .float-alert .ic{width:30px;height:30px;border-radius:8px;background:var(--safe-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .float-alert .txt{font-size:12px;line-height:1.35;}
  .float-alert .txt b{display:block;font-size:12.5px;margin-bottom:1px;}
  .float-alert .txt span{color:var(--muted);font-size:11px;}

  /* ---------- MARQUEE STAT STRIP ---------- */
  .strip{
    position:relative;z-index:1;
    border-top:1px solid var(--line);border-bottom:1px solid var(--line);
    padding:26px 48px;display:flex;justify-content:center;gap:0;flex-wrap:wrap;
  }
  .strip-item{padding:0 42px;text-align:center;border-right:1px solid var(--line);}
  .strip-item:last-child{border-right:none;}
  .strip-item .n{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;color:var(--paper);}
  .strip-item .l{font-size:11.5px;color:var(--muted-2);margin-top:4px;letter-spacing:0.02em;}

  /* ---------- SECTION SHELL ---------- */
  section{position:relative;z-index:1;padding:120px 48px;max-width:1280px;margin:0 auto;}
  .section-head{max-width:620px;margin-bottom:64px;}
  .section-head .eyebrow-line{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--flame);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;}
  .section-head h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(28px,3vw,38px);font-weight:600;letter-spacing:-0.01em;line-height:1.15;margin-bottom:16px;}
  .section-head p{color:var(--muted);font-size:15.5px;line-height:1.6;}

  /* how it works */
  .flow{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
  .flow-step{background:var(--ink);padding:36px 30px;position:relative;}
  .flow-step .num{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--flame);margin-bottom:26px;}
  .flow-step h3{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:600;margin-bottom:10px;}
  .flow-step p{font-size:13.5px;color:var(--muted);line-height:1.6;}
  .flow-step .arrow{position:absolute;right:-1px;top:36px;color:var(--muted-2);display:none;}
  @media(min-width:840px){.flow-step:not(:last-child) .arrow{display:block;}}

  /* feature grid */
  .features{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
  .feature{background:var(--ink);padding:38px;transition:background .25s;}
  .feature:hover{background:rgba(255,255,255,0.02);}
  .feature .ic{
    width:42px;height:42px;border-radius:10px;
    display:flex;align-items:center;justify-content:center;margin-bottom:22px;
  }
  .feature h3{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;margin-bottom:10px;}
  .feature p{font-size:14px;color:var(--muted);line-height:1.65;}

  /* dashboard preview */
  .preview-wrap{
    border:1px solid var(--line-strong);border-radius:20px;padding:6px;
    background:linear-gradient(160deg,var(--panel),rgba(16,31,59,0.4));
    box-shadow:0 60px 120px -50px rgba(0,0,0,0.7);
  }
  .preview{
    background:var(--panel);border-radius:15px;padding:36px;
    display:grid;grid-template-columns:1.1fr 1fr;gap:28px;
  }
  .preview-card{background:rgba(255,255,255,0.025);border:1px solid var(--line);border-radius:12px;padding:22px;}
  .preview-card h4{font-size:12.5px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;font-weight:600;}
  .alert-row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line);gap:10px;}
  .alert-row:last-child{border-bottom:none;}
  .alert-row .dot{width:7px;height:7px;border-radius:50%;margin-top:6px;flex-shrink:0;}
  .alert-row .body{font-size:12.5px;line-height:1.5;}
  .alert-row .body b{display:block;font-size:13px;margin-bottom:2px;}
  .alert-row .body span{color:var(--muted-2);font-size:11px;}
  .chip{font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;border-radius:100px;letter-spacing:0.03em;white-space:nowrap;}
  .chip-safe{background:var(--safe-dim);color:var(--safe);}
  .chip-alert{background:var(--alert-dim);color:var(--alert);}
  .bar-chart{display:flex;align-items:flex-end;gap:6px;height:90px;margin-top:6px;}
  .bar-chart div{flex:1;background:linear-gradient(180deg,var(--flame),rgba(255,138,61,0.25));border-radius:3px 3px 0 0;}

  /* CTA banner */
  .cta-band{
    position:relative;z-index:1;margin:40px 48px 0;max-width:1280px;margin-left:auto;margin-right:auto;
    border-radius:24px;padding:70px 60px;
    background:radial-gradient(ellipse 600px 300px at 20% 0%, rgba(255,138,61,0.18), transparent 70%), var(--panel);
    border:1px solid var(--line-strong);
    display:flex;justify-content:space-between;align-items:center;gap:40px;
  }
  .cta-band h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(26px,3vw,34px);font-weight:600;max-width:440px;line-height:1.2;}
  .cta-band .sub{color:var(--muted);font-size:14.5px;margin-top:10px;}

  footer{position:relative;z-index:1;padding:70px 48px 40px;max-width:1280px;margin:0 auto;}
  .footer-top{display:flex;justify-content:space-between;padding-bottom:50px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:40px;}
  .footer-cols{display:flex;gap:70px;flex-wrap:wrap;}
  .footer-col h5{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted-2);margin-bottom:16px;}
  .footer-col a{display:block;font-size:14px;color:var(--muted);margin-bottom:11px;transition:color .2s;}
  .footer-col a:hover{color:var(--paper);}
  .footer-bottom{display:flex;justify-content:space-between;padding-top:26px;font-size:12.5px;color:var(--muted-2);flex-wrap:wrap;gap:10px;}

  /* ---------- AUTH PAGES ---------- */
  .auth-shell{
    min-height:100vh;display:grid;grid-template-columns:1fr 1fr;
    position:relative;z-index:1;
  }
  .auth-visual{
    background:linear-gradient(165deg,var(--panel) 0%, var(--ink) 70%);
    border-right:1px solid var(--line);
    padding:56px;display:flex;flex-direction:column;justify-content:space-between;
    position:relative;overflow:hidden;
  }
  .auth-visual::before{
    content:'';position:absolute;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle, rgba(255,138,61,0.14), transparent 70%);
    top:-120px;right:-150px;
  }
  .auth-visual .quote{position:relative;max-width:400px;margin-top:auto;}
  .auth-visual .quote p{font-family:'Space Grotesk',sans-serif;font-size:22px;line-height:1.45;font-weight:500;margin-bottom:18px;}
  .auth-visual .quote .who{font-size:13px;color:var(--muted);}
  .auth-visual .who b{color:var(--paper);}
  .mini-gauge{position:relative;margin-top:60px;}
  .mini-gauge .row{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:10px;}
  .mini-gauge .row .ic{width:34px;height:34px;border-radius:8px;background:var(--safe-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .mini-gauge .row b{font-size:13px;display:block;}
  .mini-gauge .row span{font-size:11.5px;color:var(--muted);}

  .auth-form-side{display:flex;align-items:center;justify-content:center;padding:56px;}
  .auth-form{width:100%;max-width:400px;}
  .auth-form .back{font-size:13px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;margin-bottom:40px;transition:color .2s;}
  .auth-form .back:hover{color:var(--paper);}
  .auth-form h1{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;margin-bottom:10px;letter-spacing:-0.01em;}
  .auth-form p.sub{color:var(--muted);font-size:14.5px;margin-bottom:34px;}
  .field{margin-bottom:18px;}
  .field label{display:block;font-size:12.5px;color:var(--muted);margin-bottom:8px;letter-spacing:0.01em;}
  .field input{
    width:100%;padding:13px 14px;background:rgba(255,255,255,0.03);
    border:1px solid var(--line-strong);border-radius:9px;color:var(--paper);font-size:14.5px;
    transition:border-color .2s, background .2s;
  }
  .field input:focus{outline:none;border-color:var(--flame);background:rgba(255,138,61,0.04);}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .field-inline{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;font-size:13px;}
  .checkbox{display:flex;align-items:center;gap:8px;color:var(--muted);}
  .checkbox input{width:15px;height:15px;accent-color:var(--flame);}
  .field-inline a{color:var(--flame);}
  .divider{display:flex;align-items:center;gap:14px;margin:26px 0;color:var(--muted-2);font-size:12px;}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--line);}
  .oauth-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;}
  .oauth-btn{
    display:flex;align-items:center;justify-content:center;gap:8px;
    padding:11px;border:1px solid var(--line-strong);border-radius:9px;font-size:13.5px;
    transition:background .2s, border-color .2s;
  }
  .oauth-btn:hover{background:rgba(255,255,255,0.03);border-color:var(--line-strong);}
  .switch-line{text-align:center;font-size:13.5px;color:var(--muted);margin-top:28px;}
  .switch-line a{color:var(--flame);font-weight:600;}
  .terms{font-size:11.5px;color:var(--muted-2);margin-top:20px;line-height:1.6;}
  .terms a{color:var(--muted);text-decoration:underline;}

  @media(max-width:980px){
    header.hero{grid-template-columns:1fr;padding-top:150px;}
    .nav-links{display:none;}
    .flow{grid-template-columns:1fr;}
    .features{grid-template-columns:1fr;}
    .preview{grid-template-columns:1fr;}
    .auth-shell{grid-template-columns:1fr;}
    .auth-visual{display:none;}
    .cta-band{flex-direction:column;align-items:flex-start;}
  }

`;

/**
 * LPG Guardian — landing page with in-place login / signup views.
 *
 * The original markup was authored as static HTML. Rather than hand-convert
 * every element (and inline style string) into JSX, the markup is rendered
 * once via a typed ref and controlled declaratively afterwards: page
 * switching is driven by React state, and a single delegated, typed click
 * handler reads `data-page` attributes instead of relying on global
 * functions in a <script> tag.
 */
const LPGGuardianApp: React.FC = () => {
  const [activePage, setActivePage] = useState<PageName>("landing");
  const rootRef = useRef<HTMLDivElement>(null);
  const gaugeAnimated = useRef<boolean>(false);

  // Sync the `.active` class on each `.page` container whenever the
  // selected page changes, and scroll back to the top.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const pages = root.querySelectorAll<HTMLDivElement>(".page");
    pages.forEach((page) => {
      page.classList.toggle("active", page.id === `page-${activePage}`);
    });

    const navLinks = root.querySelector<HTMLDivElement>("#navLinks");
    if (navLinks) {
      navLinks.style.display = activePage === "landing" ? "flex" : "none";
    }

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [activePage]);

  // Animate the hero gauge ring once, on mount.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || gaugeAnimated.current) return;

    const fill = root.querySelector<SVGCircleElement>("#gaugeFill");
    if (!fill) return;

    gaugeAnimated.current = true;
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = String(
        GAUGE_CIRCUMFERENCE * (1 - GAUGE_FILL_PERCENT)
      );
    });
  }, []);

  // Delegated, typed click handler: any element carrying a `data-page`
  // attribute navigates to that page instead of each button owning its
  // own inline handler.
  const handleRootClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const trigger = target.closest<HTMLElement>("[data-page]");
    if (!trigger) return;

    const page = trigger.dataset.page as PageName | undefined;
    if (page === "landing" || page === "login" || page === "signup") {
      setActivePage(page);
    }
  };

  return (
    <div ref={rootRef} onClick={handleRootClick}>
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: PAGE_MARKUP }} />
    </div>
  );
};

export default LPGGuardianApp;
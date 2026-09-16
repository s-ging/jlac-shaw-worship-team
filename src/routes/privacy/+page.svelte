<script lang="ts">
  // No reactive state needed – static page
</script>

<div class="legal-page">
  <div class="container">
    <h1>Privacy Policy</h1>
    <p><strong>Effective Date:</strong> September 16, 2026</p>

    <p>
      JLAC Shaw Church ("we," "our," or "us") operates the Praise Team Scheduler
      application ("the App"). This Privacy Policy explains how we collect, use,
      and protect your information when you use the App.
    </p>

    <p>
      The App is a private tool for members of the JLAC Shaw Church worship team.
      Accounts are created by church administrators. There is no public sign-up.
    </p>

    <h2>1. Information We Collect</h2>
    <p>We collect only what is needed to schedule the worship team:</p>
    <ul>
      <li><strong>Account Information:</strong> Your name, an optional nickname, your email address, the instruments or roles you serve in, and your permission level within the App.</li>
      <li><strong>Your Password:</strong> Stored only as a salted cryptographic hash. We cannot read your password.</li>
      <li><strong>Sign-In Records:</strong> An active session identifier, and optionally the browser and device type you signed in from, so administrators can end sessions they do not recognize.</li>
      <li><strong>Activity History:</strong> A record of changes you make in the App — for example reassigning a role or updating your availability — including what changed, and when.</li>
    </ul>
    <p>
      We do <strong>not</strong> collect your Google profile, your profile picture,
      your contacts, or any calendar outside the single worship team calendar
      described below.
    </p>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>Display the worship schedule and your assignments within it.</li>
      <li>Allow worship leaders to assign team members to specific roles.</li>
      <li>Let you indicate your availability for an upcoming service.</li>
      <li>Maintain a visible history of schedule changes, so the team can see who changed what.</li>
    </ul>
    <p>We do <strong>not</strong> sell, rent, or trade your personal information, and we do not use it for advertising.</p>

    <h2>3. Google Calendar</h2>
    <p>
      The worship schedule lives in a Google Calendar owned by the church. The App
      reads that calendar to display the schedule, and writes back to it when a
      worship leader changes an assignment.
    </p>
    <p>
      This access is made through a <strong>single church-owned Google account</strong>.
      The App does not ask you to connect your personal Google account, and it has no
      access to your personal calendar, email, or Google profile.
    </p>

    <h2>4. Data Storage</h2>
    <p>
      Your account information, sessions, and activity history are stored in
      <strong>Cloudflare Workers KV</strong>, encrypted at rest, and served from
      Cloudflare's network. Some schedule data is cached in your browser so the App
      loads quickly. We retain your data for as long as your account is active, or
      as needed to provide the service.
    </p>

    <h2>5. Your Rights</h2>
    <p>
      You may request access to, correction of, or deletion of your personal data at
      any time by contacting us at the email below. If you stop using the App, we
      will remove your profile data upon request. Note that entries in the activity
      history are kept as a record of schedule changes, but can be anonymized on request.
    </p>
    <p>
      The App has no self-service password reset. If you forget your password, a
      church administrator will set a new one for you.
    </p>

    <h2>6. Third-Party Services</h2>
    <p>
      We use the following trusted third-party services:
    </p>
    <ul>
      <li><strong>Cloudflare</strong> &ndash; Hosting, application logic, and data storage.</li>
      <li><strong>Google Calendar</strong> &ndash; The source of the worship schedule.</li>
    </ul>

    <h2>7. Changes to This Policy</h2>
    <p>
      We may update this policy occasionally. Continued use of the App constitutes 
      acceptance of any changes.
    </p>

    <h2>8. Contact Us</h2>
    <p>
      If you have questions, email us at: 
      <a href="mailto:jlacshawmedia01@gmail.com">jlacshawmedia01@gmail.com</a>
    </p>
  </div>
</div>

<style>
  .legal-page {
    padding: 40px 20px;
    max-width: 720px;
    margin: 0 auto;
    background: white;
    min-height: 100svh;
  }
  .container {
    font-family: var(--font-family, -apple-system, sans-serif);
    line-height: 1.7;
    color: var(--color-text, #1a1a1a);
  }
  h1 { font-size: 28px; margin-bottom: 8px; }
  h2 { font-size: 20px; margin: 28px 0 8px; }
  ul { padding-left: 24px; }
  a { color: var(--color-primary, #2563eb); }
</style>
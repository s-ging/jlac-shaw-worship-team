<script lang="ts">
  // No reactive state needed – static page
</script>

<div class="legal-page">
  <div class="container">
    <h1>Privacy Policy</h1>
    <p><strong>Effective Date:</strong> September 3, 2026</p>

    <p>
      JLAC Shaw Church ("we," "our," or "us") operates the Praise Team Scheduler 
      application ("the App"). This Privacy Policy explains how we collect, use, 
      and protect your information when you use the App.
    </p>

    <h2>1. Information We Collect</h2>
    <p>When you sign in with Google, we collect:</p>
    <ul>
      <li><strong>Google Account Information:</strong> Your name, email address, and profile picture.</li>
      <li><strong>Google Calendar Data:</strong> Event titles, dates, descriptions, and attendee lists (used solely for worship team scheduling).</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>Display your assignments and schedule.</li>
      <li>Allow worship leaders to assign team members to specific roles.</li>
      <li>Sync schedule data between Google Calendar and our internal database (Supabase).</li>
    </ul>
    <p>We do <strong>not</strong> sell, rent, or trade your personal information.</p>

    <h2>3. Data Storage</h2>
    <p>
      Your data is stored securely in <strong>Supabase</strong> (encrypted at rest) 
      and cached locally in your browser for performance. We retain your data 
      as long as your account is active or as needed to provide the service.
    </p>

    <h2>4. Your Rights</h2>
    <p>
      You may request access to, correction of, or deletion of your personal data 
      at any time by contacting us at the email below. If you stop using the App, 
      we will remove your profile data upon request.
    </p>

    <h2>5. Third-Party Services</h2>
    <p>
      We use the following trusted third-party services:
    </p>
    <ul>
      <li><strong>Supabase</strong> – Database and authentication.</li>
      <li><strong>Google Cloud</strong> – Calendar API and OAuth.</li>
      <li><strong>Cloudflare Pages</strong> – Hosting.</li>
    </ul>

    <h2>6. Changes to This Policy</h2>
    <p>
      We may update this policy occasionally. Continued use of the App constitutes 
      acceptance of any changes.
    </p>

    <h2>7. Contact Us</h2>
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
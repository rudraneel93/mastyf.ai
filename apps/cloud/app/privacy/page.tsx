import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="container">
      <h1>Privacy Policy</h1>
      <div className="card">
        <p>
          We collect account information from Google or GitHub OAuth (email, name, profile image)
          to operate your organization on the optional cloud control plane.
        </p>
        <p>
          Policy YAML and API key metadata are stored in our database to provide the control
          plane. You may request deletion by contacting support.
        </p>
      </div>
      <Link href="/">Back to home</Link>
    </main>
  );
}

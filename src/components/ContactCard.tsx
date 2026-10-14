import styles from "../styles/Contact.module.scss";
import mail from "../assets/contact/mail.webp";

interface ContactCardProps {
  image?: string; // leave out to show a placeholder
  name: string;
  email: string;
}

// Opens Gmail's "compose" view with the recipient pre-filled. Routed through
// Google's account chooser first, so if the user is signed into more than one
// Google account, they get to pick which one to send from before compose opens.
// Falls back to a plain mailto: link if the tab is blocked (e.g. popup
// blockers) or the user isn't on Gmail.
function openGmailCompose(email: string) {
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    email
  )}`;
  const accountChooserUrl = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(
    gmailUrl
  )}`;

  const tab = window.open(accountChooserUrl, "_blank", "noopener,noreferrer");

  if (!tab) {
    window.location.href = `mailto:${email}`;
  }
}

// Shown instead of a photo: a sepia frame with a silhouette and initials.
function PhotoPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className={styles.photoPlaceholder} role="img" aria-label={`Photo of ${name} coming soon`}>
      <svg viewBox="0 0 100 90" aria-hidden="true">
        <circle cx="50" cy="30" r="19" />
        <path d="M8 90c0-25 18-38 42-38s42 13 42 38z" />
      </svg>
      <span className={styles.initials}>{initials}</span>
      <span className={styles.soon}>Photo soon</span>
    </div>
  );
}

export default function ContactCard({ image, name, email }: ContactCardProps) {
  const handleMailClick = () => openGmailCompose(email);

  return (
    <div className={styles.cardContainer}>
      {image ? (
        <img className={styles.stuccanImage} src={image} alt={name} />
      ) : (
        <PhotoPlaceholder name={name} />
      )}
      <section className={styles.details}>
        <h1>{name}</h1>
        <img
          src={mail}
          alt={`Email ${name}`}
          title={`Email ${name}`}
          className={styles.mail}
          role="button"
          tabIndex={0}
          onClick={handleMailClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMailClick();
            }
          }}
        />
      </section>
    </div>
  );
}
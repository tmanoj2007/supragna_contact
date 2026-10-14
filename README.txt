OASIS 2026 - Contact Us page update
===================================

1. See it now
   Double-click oasis-contact-preview.html. It opens in your browser
   (works offline, nothing to install).

2. Put it in the real project
   The src/ folder mirrors the project's folders. Copy:
     src/pages/Contact.tsx          -> your project's src/pages/
     src/components/ContactCard.tsx -> your project's src/components/
     src/styles/Contact.module.scss -> your project's src/styles/
   Keep your own "import map from ..." line in Contact.tsx so it still
   uses the carnival map.
   Then run:  npm run dev   and open /contactus

   Or, if your Contact files still match GitHub's main branch:
     git apply contact-map-fit.patch

What changed
- Map fits the screen height (no more over-zoom blur)
- Click a role or a pin: smooth zoom-and-fly to that card
- Only the selected card shows; cards are smaller; pins are clickable
- Cards always land fully in view, even near the map edges
- Photos replaced with placeholders (add real ones via `image:` in CONTACTS)
- 3D gold "CONTACT US" heading

Tweak card size: CARD_SCALE_MAX near the top of Contact.tsx (0.6 now).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import map from "../assets/contact/map.webp";
import cross from "../assets/contact/cross.webp";
import styles from "../styles/Contact.module.scss";
import back from "../assets/contact/backButton.webp";

// Team photos: none yet, every card shows a placeholder (see ContactCard).
// To add one later: import it here, e.g.
//   import pcr from "../assets/contact/snehaSrivastava.webp";
// then set `image: pcr` on that person in CONTACTS below. The Preloader
// picks it up automatically.

// ContactCard also imports this (for the on-card mail icon); imported again
// here purely so its URL can go in CONTACT_ASSETS below.
import mail from "../assets/contact/mail.webp";
// These three are referenced only via CSS url() in Contact.module.scss, never
// rendered from these bindings — imported here purely to get their
// bundler-resolved URLs for CONTACT_ASSETS, so the Preloader warms them too.
import cardBg from "../assets/contact/card.webp";
import pageBg from "../assets/contact/page.webp";
import pageMobBg from "../assets/contact/pageMob.webp";

import ContactCard from "../components/ContactCard";
import Preloader from "../pages/Preloader";
import { useTransition } from "../context/TransitionProvider";

// ─────────────────────────────────────────────────────────────
// CONTACTS — one row per list item / cross / card.
// Row i in this array is wired together:
//   list item i (in "CONTACT US")  ->  cross i  ->  ContactCard i
//
// x / y = position of the cross, as PERCENTAGES of the map image itself:
//   x: 0 = left edge,  100 = right edge
//   y: 0 = top edge,   100 = bottom edge
// The card sits just below its cross automatically.
// Pixel -> percent:  x% = pixelX / imageWidth * 100
// image (optional): a photo URL; leave it out to show a placeholder.
// ─────────────────────────────────────────────────────────────
const CONTACTS: { label: string; x: number; y: number; name: string; email: string; image?: string }[] = [
  {
    label: "Registrations and Correspondence",
    x: 72, y: 76,
    name: "Sneha Srivastava",
    email: "f20230855@pilani.bits-pilani.ac.in",
  },
  {
    label: "Website, App and Payments",
    x: 79.5, y: 45,
    name: "Avyakt Verma",
    email: "f20231083@pilani.bits-pilani.ac.in",
  },
  {
    label: "Sponsorships and Company Collaborations",
    x: 63, y: 40,
    name: "Praful Malik",
    email: "f20240605@pilani.bits-pilani.ac.in",
  },
  {
    label: "Logistics and Operations",
    x: 48, y: 54,
    name: "Shreyas Anand",
    email: "f20230906@pilani.bits-pilani.ac.in",
  },
  {
    label: "Reception and Accommodation",
    x: 33, y: 71,
    name: "Prithvi Gowda C",
    email: "f20230327@pilani.bits-pilani.ac.in",
  },
  {
    label: "Online Collaborations and Publicity",
    x: 34, y: 20,
    name: "Devansh Agarwal",
    email: "f20230812@pilani.bits-pilani.ac.in",
  },
  {
    label: "President, Students' Union",
    x: 50, y: 15,
    name: "Pulkit Bhardwaj",
    email: "president@pilani.bits-pilani.ac.in",
  },
  {
    label: "General Secretary, Students' Union",
    x: 68, y: 12,
    name: "Kushal Poosala",
    email: "gensec@pilani.bits-pilani.ac.in",
  },
];

// Card shown by default when the page loads (see getCardCenterTarget() and
// the initial pos.current assignment inside the effect below). Looked up by
// name rather than a hard-coded index, so reordering CONTACTS later doesn't
// silently point this at someone else.
const DEFAULT_CARD_NAME = "Avyakt Verma";
const DEFAULT_CARD_INDEX = Math.max(
  0,
  CONTACTS.findIndex((c) => c.name === DEFAULT_CARD_NAME),
);

// ─────────────────────────────────────────────────────────────
// Every image this page actually uses, for the <Preloader> below — so the
// map, crosses, mail icon, backgrounds and every team photo are all already
// cached by the time the page reveals, instead of popping in individually.
// ─────────────────────────────────────────────────────────────
const CONTACT_ASSETS = [
  map,
  cross,
  back,
  mail,
  cardBg,
  pageBg,
  pageMobBg,
  ...CONTACTS.flatMap((c) => (c.image ? [c.image] : [])),
];

// Keyboard controls. Uses e.code (physical keys), so W/A/S/D work on any
// keyboard layout. Values are the direction the VIEW moves across the map.
const KEY_DIRECTIONS: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};
// Extra px around the visible entries of the mobile list (room for the hover glow)
const LIST_PEEK_PADDING = 6;
// Pixels per frame the map moves while a movement key is held.
const KEY_SPEED = 12;

// ── Zoom & "fly to card" ──
// Zoom used when a contact is clicked (1 = whole map height on screen).
const FOCUS_ZOOM = 1.45;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.2;
// How long the fly-to-card animation takes, in ms.
const FLY_MS = 900;
// Card design size in px (see .cardContainer in the SCSS) and the range
// its on-screen scale may take (set automatically to fit the window).
const CARD_W = 362;
const CARD_H = 381;
const CARD_SCALE_MIN = 0.3;
const CARD_SCALE_MAX = 0.6;
// Gap kept between a card and the screen edge when it's at the map's edge.
const CARD_EDGE_PADDING = 16;

type Camera = { x: number; y: number; z: number };
type Flight = { from: Camera; to: Camera; ms: number; dip: number; t0: number };

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Contact() {
  const { entered, markEntered, transitioning } = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const mapScaleRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Absolute map coordinates
  const pos = useRef({ x: 0, y: 0 });
  // Velocity vector (used ONLY for mouse/touch flick momentum)
  const vel = useRef({ x: 0, y: 0 });
  // Zoom level of the map (1 = map exactly fits the screen height)
  const zoom = useRef(1);
  // An in-progress "fly to a card" animation (null = none running)
  const flight = useRef<Flight | null>(null);

  const isDragging = useRef(false); // pointer is down
  const didDrag = useRef(false); // pointer moved far enough to count as a drag
  const isFlicking = useRef(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const animFrameId = useRef<number | null>(null);

  // Set inside the effect, called by the list items
  const scrollToCard = useRef<(index: number) => void>(() => {});
  // Re-centers on DEFAULT_CARD_INDEX's card. Set inside the main effect below;
  // also called from the font/transition-settle effect further down, to
  // correct the initial position if it was computed before layout was
  // actually stable (see that effect for why).
  const centerDefaultCard = useRef<(opts?: { instant?: boolean }) => void>(
    () => {},
  );
  // Called when the map image finishes loading (its size is only known then).
  // Set inside the main effect below.
  const onMapLoad = useRef<() => void>(() => {});

  // Which list item / card is the currently "selected" one. Stays highlighted
  // until another item is clicked, or the map is dragged / scrolled.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Mirror of activeIndex that the keyboard handlers (inside the effect) can
  // read without going stale. Always update both together via setActive().
  const activeIndexRef = useRef<number | null>(null);
  const setActive = (i: number | null) => {
    activeIndexRef.current = i;
    setActiveIndex(i);
  };
  // Mobile only: is the "CONTACT US" panel expanded ("See Less") or collapsed
  // ("See More")? Has no visual effect on desktop (the toggle is hidden there).
  const [expanded, setExpanded] = useState(false);
  // Movement keys currently held down (by e.code)
  const pressedKeys = useRef<Set<string>>(new Set());

  // Touchpad (two-finger scroll) speed. Was 0.35 (felt slow). Lower = slower, higher = faster.
  const SCROLL_SENSITIVITY = 0.9;
  // Touch-screen drag speed multiplier (1 = map follows the finger 1:1, higher = faster).
  // Mouse drags are left at 1:1 so the map stays under the cursor.
  const TOUCH_DRAG_SENSITIVITY = 1.6;
  // A real mouse wheel steps through the list items; minimum ms between steps.
  const WHEEL_STEP_COOLDOWN = 120;
  // Wheel events arriving within this many ms of a touchpad event are treated as
  // part of the same touchpad gesture (covers momentum/inertia tails).
  const TOUCHPAD_GESTURE_GAP = 120;
  // Pixels the pointer must move before a press becomes a drag (keeps clicks working)
  const DRAG_THRESHOLD = 5;
  // Reduces how far down the map can shift to reveal content hidden behind
  // .page (see getOffsetY() below) — so BOTH the initial view AND the
  // furthest-down drag position sit this many px higher than the "fully
  // revealed" position. (A previous version only nudged the initial position;
  // the very first drag/flick re-clamped against the un-nudged bound and
  // undid it. Baking it into getOffsetY() itself means every bound derived
  // from it — initial position, max drag extent, resize/collapse recalcs —
  // is consistently nudged, so it can't be silently erased by any of them.)
  const VIEW_NUDGE_UP = 20;
  // Matches .page's collapse transition duration in the SCSS (0.4s) — see
  // handleListClick, which retargets the card auto-scroll once .page has
  // actually finished collapsing.
  const COLLAPSE_TRANSITION_MS = 400;

  useEffect(() => {
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return;

    // .page pins to the top of the screen on small screens and never moves,
    // so whatever's directly under it is always hidden. But .page's own box
    // is taller than what's actually drawn there: the parchment graphic lives
    // on ::before, which slides up via a CSS transform when the list is
    // collapsed (see "See More" in the SCSS) — so only PART of .page's box is
    // opaque there, the rest is transparent and the map already shows through
    // it. This measures ::before's real on-screen position (rather than
    // assuming how far it slides), so it's correct both collapsed and
    // expanded, and mid-animation between the two. Returns null when .page
    // isn't a top bar at all (desktop side panel), where it doesn't obstruct
    // the map vertically.
    const getPageBottom = (): number | null => {
      const c = container.getBoundingClientRect();
      const p = pageRef.current?.getBoundingClientRect();
      if (!p || p.height >= c.height * 0.9) return null; // not a top bar (desktop)

      let slideY = 0;
      if (pageRef.current) {
        const beforeTransform = getComputedStyle(pageRef.current, "::before").transform;
        if (beforeTransform && beforeTransform !== "none") {
          slideY = new DOMMatrixReadOnly(beforeTransform).f; // translateY, in px
        }
      }

      // ::before is `inset: 0` (same box as .page) then slid by slideY (<= 0).
      // What's actually visible/opaque is the part of that box still inside
      // .page's bounds after the slide.
      const visibleHeight = Math.max(0, Math.min(p.height, p.height + slideY));
      return p.top + visibleHeight;
    };

    const getOffsetY = () => {
      const c = container.getBoundingClientRect();
      const bottom = getPageBottom();
      if (bottom === null) return 0; // desktop: .page doesn't obstruct vertically
      return Math.max(0, bottom - c.top - VIEW_NUDGE_UP);
    };

    // Desktop twin of getOffsetY(): .page is a side panel covering the left
    // part of the screen, so the visible map area starts at its right edge.
    // 0 on mobile, where .page is a top bar instead.
    const getOffsetX = () => {
      const c = container.getBoundingClientRect();
      const p = pageRef.current?.getBoundingClientRect();
      if (!p || p.width >= c.width * 0.9 || p.height < c.height * 0.9) return 0;
      return Math.max(0, p.right - c.left);
    };

    // The part of the screen the map is actually visible in (not under .page),
    // in container coordinates.
    const getVisibleArea = () => ({
      left: getOffsetX(),
      top: getOffsetY(),
      right: container.clientWidth,
      bottom: container.clientHeight,
    });

    // Everything that can be panned to, in UN-zoomed map-layer coordinates:
    // the map image, grown to include any card hanging off its edges, so a
    // card near an edge can always be brought fully into view (the old
    // bounds stopped at the map edge, which left those cards half cut off).
    // Measured, then cached until the next resize / image load, because
    // getBounds() runs every frame.
    let panBox: { l: number; t: number; r: number; b: number } | null = null;
    const getPanBox = () => {
      if (panBox) return panBox;
      const l = layer.getBoundingClientRect();
      const z = zoom.current;
      const box = { l: 0, t: 0, r: layer.offsetWidth, b: layer.offsetHeight };
      cardRefs.current.forEach((card) => {
        if (!card) return;
        const r = card.getBoundingClientRect();
        box.l = Math.min(box.l, (r.left - l.left) / z - CARD_EDGE_PADDING);
        box.t = Math.min(box.t, (r.top - l.top) / z - CARD_EDGE_PADDING);
        box.r = Math.max(box.r, (r.right - l.left) / z + CARD_EDGE_PADDING);
        box.b = Math.max(box.b, (r.bottom - l.top) / z + CARD_EDGE_PADDING);
      });
      panBox = box;
      return box;
    };

    // Card size: chosen so that a card, once flown to (at FOCUS_ZOOM), fills
    // under half of the visible map area, whatever the window size, so the
    // map around it stays visible and a card never lands cut off.
    const fitCardScale = () => {
      const v = getVisibleArea();
      const w = v.right - v.left;
      const h = v.bottom - v.top;
      const s = Math.min((w * 0.45) / CARD_W, (h * 0.45) / CARD_H) / FOCUS_ZOOM;
      container.style.setProperty(
        "--card-scale",
        Math.min(CARD_SCALE_MAX, Math.max(CARD_SCALE_MIN, s)).toFixed(3),
      );
      panBox = null; // card sizes changed
    };

    const getBounds = (z = zoom.current) => {
      const v = getVisibleArea();
      const box = getPanBox();
      // Map edges may not come inside the visible area (no dark gaps), except
      // as far as a card overhanging that edge needs.
      return {
        minX: v.right - box.r * z,
        maxX: v.left - box.l * z,
        minY: v.bottom - box.b * z,
        maxY: v.top - box.t * z,
      };
    };

    const clampPos = (p: { x: number; y: number }, z = zoom.current) => {
      const { minX, maxX, minY, maxY } = getBounds(z);
      // If the content is smaller than the view on an axis, centre it.
      return {
        x: minX > maxX ? (minX + maxX) / 2 : Math.max(minX, Math.min(maxX, p.x)),
        y: minY > maxY ? (minY + maxY) / 2 : Math.max(minY, Math.min(maxY, p.y)),
      };
    };

    // True when an event happened on (or inside) the .page panel. Pressing /
    // dragging there must not move the map (touchpad scrolling still works).
    const isOverPage = (e: Event) =>
      !!pageRef.current && pageRef.current.contains(e.target as Node);

    // Where the camera must be for the given card to sit centred in the
    // visible map area at zoom z. Returns null if that card isn't rendered.
    const getCardCenterTarget = (index: number, z: number): Camera | null => {
      const card = cardRefs.current[index];
      if (!card) return null;

      const v = getVisibleArea();
      const l = layer.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const zNow = zoom.current;

      // Card centre in UN-zoomed map-layer coordinates
      const cardX = (r.left + r.width / 2 - l.left) / zNow;
      const cardY = (r.top + r.height / 2 - l.top) / zNow;

      const centerX = (v.left + v.right) / 2;
      const centerY = (v.top + v.bottom) / 2;
      return { ...clampPos({ x: centerX - cardX * z, y: centerY - cardY * z }, z), z };
    };

    // Fly the camera to `to`: ONE smooth, time-based move (same duration on a
    // 60Hz or 120Hz screen), easing in and out. On long hops it zooms out a
    // little mid-way and back in, like a maps app, so you can see where
    // you're going. Replaces the old "move 8% closer every frame" glide,
    // which lurched at the start and crawled at the end.
    const flyTo = (to: Camera, ms = FLY_MS) => {
      isFlicking.current = false;
      vel.current = { x: 0, y: 0 };
      if (prefersReducedMotion()) {
        pos.current = { x: to.x, y: to.y };
        zoom.current = to.z;
        flight.current = null;
        return;
      }
      const from = { x: pos.current.x, y: pos.current.y, z: zoom.current };
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      flight.current = { from, to, ms, dip: Math.min(0.5, dist / 1600), t0: performance.now() };
    };

    // Centers on DEFAULT_CARD_INDEX's card, zoomed in, so the page doesn't
    // open on an arbitrary corner of the map. instant=true snaps (first
    // guess at mount); instant=false flies there (later correction once fonts
    // and the page transition have settled).
    centerDefaultCard.current = ({ instant = false } = {}) => {
      fitCardScale();
      const t = getCardCenterTarget(DEFAULT_CARD_INDEX, FOCUS_ZOOM) ?? {
        ...clampPos({ x: pos.current.x, y: getOffsetY() }),
        z: zoom.current,
      };
      if (instant) {
        flight.current = null;
        pos.current = { x: t.x, y: t.y };
        zoom.current = t.z;
      } else {
        flyTo(t, 500);
      }
    };
    centerDefaultCard.current({ instant: true });
    setActive(DEFAULT_CARD_INDEX);

    // Zoom in on the chosen card and fly to it
    scrollToCard.current = (index: number) => {
      const t = getCardCenterTarget(index, FOCUS_ZOOM);
      if (t) flyTo(t);
    };

    // Zoom by a factor around a point on screen (container coordinates),
    // keeping that point still. Used by Ctrl+wheel / touchpad pinch.
    const zoomAround = (px: number, py: number, factor: number) => {
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current * factor));
      const k = z / zoom.current;
      zoom.current = z;
      pos.current = clampPos({ x: px - (px - pos.current.x) * k, y: py - (py - pos.current.y) * k });
    };

    // 1. Wheel input. Two very different devices send "wheel" events:
    //    - Touchpad (two-finger scroll): pans the map, anywhere — including over .page.
    //    - Real mouse wheel: steps through the list items if one is selected,
    //      otherwise does nothing.
    let lastTouchpadTime = 0;
    let lastWheelStepTime = 0;

    // Heuristic (browsers don't say which device produced a wheel event):
    // a mouse wheel sends big, whole-number, vertical-only notches (or line-based
    // deltas in Firefox); a touchpad sends small, fractional and/or diagonal
    // deltas in a rapid stream. Events right after a touchpad event are treated
    // as the same gesture so momentum tails aren't mistaken for a mouse wheel.
    const isMouseWheel = (e: WheelEvent, now: number) => {
      if (now - lastTouchpadTime < TOUCHPAD_GESTURE_GAP) return false;
      if (e.deltaMode !== 0) return true; // lines / pages => mouse wheel
      return (
        e.deltaX === 0 &&
        Number.isInteger(e.deltaY) &&
        Math.abs(e.deltaY) >= 40
      );
    };

    const handleWheel = (e: WheelEvent) => {
      // Collapsed mobile list is scrollable: let it scroll natively
      const list = listRef.current;
      if (list && list.contains(e.target as Node) && list.scrollHeight > list.clientHeight + 1) {
        return;
      }

      e.preventDefault();
      // Ctrl+wheel / touchpad pinch: zoom around the pointer
      if (e.ctrlKey) {
        flight.current = null;
        isFlicking.current = false;
        const c = container.getBoundingClientRect();
        zoomAround(e.clientX - c.left, e.clientY - c.top, Math.exp(-e.deltaY * 0.01));
        return;
      }

      const now = performance.now();

      if (isMouseWheel(e, now)) {
        const current = activeIndexRef.current;
        if (current === null) return; // nothing selected: wheel does nothing
        if (now - lastWheelStepTime < WHEEL_STEP_COOLDOWN) return;

        const dir = Math.sign(e.deltaY); // down = next, up = previous
        if (dir === 0) return;
        lastWheelStepTime = now;

        const next = Math.max(0, Math.min(CONTACTS.length - 1, current + dir));
        if (next !== current) {
          setActive(next);
          scrollToCard.current(next);
        }
        return;
      }

      // Touchpad: pan the map
      lastTouchpadTime = now;

      // Cancel any ongoing momentum / auto-scroll
      isFlicking.current = false;
      flight.current = null;
      vel.current = { x: 0, y: 0 };
      setActive(null);

      // Apply dampened deltas
      pos.current.x -= e.deltaX * SCROLL_SENSITIVITY;
      pos.current.y -= e.deltaY * SCROLL_SENSITIVITY;
      pos.current = clampPos(pos.current);
    };

    // 2. Click-and-Drag / Touch input
    // NOTE: pointer capture is only taken once the pointer has actually moved
    // (DRAG_THRESHOLD). Capturing on pointerdown would redirect the click event
    // to the container and break clicks on list items and the mail icon.
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Pressing on the .page panel must not start a map drag
      if (isOverPage(e)) return;

      isDragging.current = true;
      didDrag.current = false;
      isFlicking.current = false;
      flight.current = null;
      startPointer.current = { x: e.clientX, y: e.clientY };
      lastPointer.current = { x: e.clientX, y: e.clientY };
      vel.current = { x: 0, y: 0 };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      if (!didDrag.current) {
        const moved = Math.hypot(
          e.clientX - startPointer.current.x,
          e.clientY - startPointer.current.y
        );
        if (moved < DRAG_THRESHOLD) return;
        didDrag.current = true;
        container.setPointerCapture(e.pointerId);
        setActive(null);
      }

      // Touch screens get a speed boost; mouse/pen stay 1:1 with the cursor.
      // The scaled delta also feeds the flick velocity, so glides speed up too.
      const speed = e.pointerType === "touch" ? TOUCH_DRAG_SENSITIVITY : 1;
      const dx = (e.clientX - lastPointer.current.x) * speed;
      const dy = (e.clientY - lastPointer.current.y) * speed;

      pos.current.x += dx;
      pos.current.y += dy;

      // Track drag velocity for post-release glide
      vel.current = { x: dx, y: dy };
      lastPointer.current = { x: e.clientX, y: e.clientY };

      pos.current = clampPos(pos.current);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (didDrag.current) {
        didDrag.current = false;
        isFlicking.current = true;
        if (container.hasPointerCapture(e.pointerId)) {
          container.releasePointerCapture(e.pointerId);
        }
      }
    };

    // 3. Render, Auto-scroll & Friction Loop
    const render = () => {
      // Keyboard movement (W/A/S/D + arrows) — only when no list item is selected
      if (pressedKeys.current.size > 0 && activeIndexRef.current === null) {
        let dx = 0;
        let dy = 0;
        pressedKeys.current.forEach((code) => {
          const dir = KEY_DIRECTIONS[code];
          if (dir) {
            dx += dir.x;
            dy += dir.y;
          }
        });

        if (dx !== 0 || dy !== 0) {
          // Normalise so diagonals aren't faster (and W+A on both sets don't double up)
          const len = Math.hypot(dx, dy);
          // Moving the view right means the map shifts left, hence the minus
          pos.current.x -= (dx / len) * KEY_SPEED;
          pos.current.y -= (dy / len) * KEY_SPEED;
          pos.current = clampPos(pos.current);
        }
      }

      // Fly-to-card animation (time-based, see flyTo)
      if (flight.current) {
        const { from, to, ms, dip, t0 } = flight.current;
        const t = Math.min(1, (performance.now() - t0) / ms);
        const e = easeInOutCubic(t);
        // Zoom: ease from -> to, dipping out a little mid-way on long hops
        const z = Math.max(MIN_ZOOM, from.z + (to.z - from.z) * e - dip * Math.sin(Math.PI * t));
        // Pan: move the map point under the view centre in a straight line,
        // so pan and zoom stay in step (no sideways swing while zooming).
        const v = getVisibleArea();
        const cx = (v.left + v.right) / 2;
        const cy = (v.top + v.bottom) / 2;
        const fx = (cx - from.x) / from.z;
        const fy = (cy - from.y) / from.z;
        const tx = (cx - to.x) / to.z;
        const ty = (cy - to.y) / to.z;
        const px = fx + (tx - fx) * e;
        const py = fy + (ty - fy) * e;
        zoom.current = z;
        pos.current = { x: cx - px * z, y: cy - py * z };
        if (t >= 1) {
          pos.current = { x: to.x, y: to.y };
          zoom.current = to.z;
          flight.current = null;
        }
      }

      // Apply momentum decay ONLY after releasing a click-and-drag flick
      if (isFlicking.current) {
        if (Math.abs(vel.current.x) > 0.1 || Math.abs(vel.current.y) > 0.1) {
          pos.current.x += vel.current.x;
          pos.current.y += vel.current.y;
          pos.current = clampPos(pos.current);

          vel.current.x *= 0.92; // Friction factor
          vel.current.y *= 0.92;
        } else {
          isFlicking.current = false;
        }
      }

      // The whole layer (map image + crosses + cards) moves together
      layer.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0px) scale(${zoom.current})`;

      animFrameId.current = requestAnimationFrame(render);
    };

    // Re-clamp on resize so the position stays valid whichever map scale is
    // now in effect. Also nudge pos.y by however much getOffsetY() itself
    // changed (e.g. crossing the mobile breakpoint, or .page's height
    // changing with viewport width), so the view shifts with it instead of
    // just getting clamped to a new edge.
    let lastOffsetY = getOffsetY();
    const handleResize = () => {
      fitCardScale(); // window size changed: re-fit cards (also resets panBox)
      const offsetY = getOffsetY();
      pos.current.y += offsetY - lastOffsetY;
      lastOffsetY = offsetY;
      pos.current = clampPos(pos.current);
    };

    // 4. Keyboard
    //  - Nothing selected: W/A/S/D + arrows pan the map (held keys, see render()).
    //  - A list item is selected: W/S/↑/↓ step through the list items;
    //    A/D/←/→ unselect it and pan the map from that same press.
    const handleKeyDown = (e: KeyboardEvent) => {
      // Leave browser shortcuts (Ctrl+S, Ctrl+D, Alt+←, ...) alone
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const dir = KEY_DIRECTIONS[e.code];
      if (!dir) return;

      // Don't hijack typing in form fields
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }

      e.preventDefault();

      const current = activeIndexRef.current;

      // Vertical key while a list item is selected -> move through the list
      if (current !== null && dir.y !== 0) {
        if (e.repeat) return; // one step per press
        const next = Math.max(0, Math.min(CONTACTS.length - 1, current + dir.y));
        if (next !== current) {
          setActive(next);
          scrollToCard.current(next);
        }
        return;
      }

      // Horizontal key while a list item is selected -> unselect it
      if (current !== null) setActive(null);

      // Start / continue panning; cancel any glide or auto-scroll in progress
      isFlicking.current = false;
      flight.current = null;
      vel.current = { x: 0, y: 0 };
      pressedKeys.current.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.code);
    };

    // Avoid a "stuck" key if the tab loses focus while one is held
    const handleBlur = () => {
      pressedKeys.current.clear();
    };

    // The map is sized to the screen in CSS, but its width is only known once
    // the image has loaded — re-measure and re-centre then.
    onMapLoad.current = () => {
      lastOffsetY = getOffsetY();
      centerDefaultCard.current({ instant: true });
    };
    const mapImg = layer.querySelector("img");
    if (mapImg instanceof HTMLImageElement && mapImg.complete && mapImg.naturalWidth) {
      onMapLoad.current();
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  // The initial centering above (centerDefaultCard.current({ instant: true }))
  // runs at mount, using whatever layout exists at that exact instant. Two
  // things can make that layout wrong, specifically when this page is reached
  // via Nav's SPA transition rather than a direct/refreshed URL:
  //  - Fonts: a font this page uses (e.g. the card's name heading) may not
  //    have been requested yet by the time Contact mounts, if it wasn't part
  //    of whatever the app-level Preloader warmed before Home first showed.
  //    The browser renders a fallback font, THEN swaps once the real one
  //    loads, reflowing the card and silently invalidating the measurement
  //    centerDefaultCard.current() already took (same class of bug the list
  //    measurement above already guards against, for the same reason).
  //  - The transition itself: Contact mounts while `transitioning` is still
  //    true (the curtain is still covering the screen, mid-animation) — by
  //    the time it settles, more than enough has happened for a layout change
  //    to slip in unnoticed.
  // Re-running once both are known-settled corrects either case. It's a no-op
  // if the first guess was already right. On a direct/refreshed load,
  // `transitioning` is false from the start, so this just re-confirms it
  // once fonts are ready.
  useEffect(() => {
    let cancelled = false;
    if (!transitioning) {
      document.fonts?.ready.then(() => {
        if (!cancelled) centerDefaultCard.current();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [transitioning]);

  // Measure the list so the mobile collapse/expand can animate max-height:
  //   --list-collapsed = height showing only the first 2 entries
  //   --list-expanded  = height showing every entry
  // (measured, not hard-coded, because entries can wrap onto 2 lines)
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const second = list.children[1] as HTMLElement | undefined;
      if (!second) return;
      const collapsed = second.offsetTop + second.offsetHeight + LIST_PEEK_PADDING;
      list.style.setProperty("--list-collapsed", `${collapsed}px`);
      list.style.setProperty("--list-expanded", `${list.scrollHeight}px`);
    };

    measure();
    window.addEventListener("resize", measure);
    // Fonts loading late changes line heights
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // When the selected entry changes (click, W/S, mouse wheel), scroll the
  // collapsed list so it stays in view. Adjusts the list's own scrollTop only —
  // scrollIntoView() could also shift the overflow:hidden map container.
  useEffect(() => {
    const list = listRef.current;
    if (activeIndex === null || !list) return;
    if (list.scrollHeight <= list.clientHeight + 1) return;

    const li = list.children[activeIndex] as HTMLElement | undefined;
    if (!li) return;

    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTo({ top: Math.max(0, top - LIST_PEEK_PADDING), behavior: "smooth" });
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: bottom - list.clientHeight + LIST_PEEK_PADDING, behavior: "smooth" });
    }
  }, [activeIndex]);

  const handleListClick = (index: number) => {
    setActive(index);

    if (expanded) {
      // Collapse first. scrollToCard needs .page's post-collapse geometry to
      // center the card correctly (see getPageBottom()); calling it now, while
      // .page is still expanded, would send the view toward a target based on
      // the OLD geometry and then immediately redirect it once the real
      // (collapsed) geometry is known 400ms later — two different targets in
      // quick succession, which looked like a jump. Waiting for the collapse
      // to finish means there's only ever one target.
      setExpanded(false);
      window.setTimeout(() => scrollToCard.current(index), COLLAPSE_TRANSITION_MS);
    } else {
      scrollToCard.current(index);
    }
  };

  return (
    <div ref={containerRef} className={styles.mapContainer}>
      {/* Map layer: same size as the map image, receives the drag transform */}
      <div ref={layerRef} className={styles.mapLayer}>
        {/* Scaled down on small screens via CSS; crosses/cards counter-scale
            back to full size (see Contact.module.scss) */}
        <div ref={mapScaleRef} className={styles.mapScale}>
          <img
            src={map}
            alt=""
            className={styles.mapImage}
            onLoad={() => onMapLoad.current()}
          />

          {CONTACTS.map((c, i) => (
            <img
              key={`cross-${i}`}
              src={cross}
              alt=""
              className={`${styles.cross} ${i === activeIndex ? styles.crossActive : ""}`}
              title={`${c.name} — ${c.label}`}
              onClick={() => handleListClick(i)}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            />
          ))}

          {/* Cards sit just below their crosses (offset handled in the SCSS).
              Only the selected one is shown; the rest stay hidden so the map
              isn't covered. Click a cross (pin) or a list item to open one. */}
          {CONTACTS.map((c, i) => (
            <div
              key={`card-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`${styles.cardAnchor} ${i === activeIndex ? styles.cardActive : ""}`}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            >
              <ContactCard image={c.image} name={c.name} email={c.email} />
            </div>
          ))}
        </div>
      </div>

      <section
        ref={pageRef}
        className={`${styles.page} ${expanded ? styles.expanded : ""}`}
      >
        <div className={styles.pageStuff}>
          <Link to="/">
            <img className={styles.backBtn} src={back} alt="Go Back to Home" />
          </Link>
          <h1>CONTACT US</h1>
          <ul ref={listRef}>
            {CONTACTS.map((c, i) => (
              <li
                key={c.label}
                className={i === activeIndex ? styles.active : undefined}
                onClick={() => handleListClick(i)}
              >
                {c.label}
              </li>
            ))}
          </ul>
          {/* Mobile only (hidden on desktop in the SCSS) */}
          <h2
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded((v) => !v);
              }
            }}
          >
            {expanded ? "See Less" : "See More"}
          </h2>
        </div>
      </section>

      {/* Overlaid, not a replacement — the map above stays mounted the whole
          time so its drag/pan effect (which only runs once) attaches to real
          refs from the very first render. Once the assets finish loading and
          the exit animation runs, Preloader calls markEntered() and unmounts
          here, revealing the already-ready map underneath. Skipped entirely
          if the preloader already played elsewhere this session (`entered`
          is a single session-wide flag from TransitionProvider). */}
      {!entered && (
        <Preloader assets={CONTACT_ASSETS} onEnter={markEntered} />
      )}
    </div>
  );
}
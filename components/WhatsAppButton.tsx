"use client";

/**
 * Floating WhatsApp chat-bubble in the bottom-right of every page.
 * Click → opens https://wa.me/<number>?text=<prefilled> which lands
 * in the WhatsApp app on mobile or web.whatsapp.com on desktop.
 *
 * Hidden on print. Suppressed on /offerte/[ref] (the public share-link
 * page that recipients open — the chat-button there would target the
 * sender's WhatsApp not the recipient's).
 */

import { usePathname } from "next/navigation";

const WA_NUMBER = "31640241646"; // +31 6 4024 1646
const WA_MESSAGE = "Hoi, ik heb een vraag over Renisual.";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

export default function WhatsAppButton() {
  const pathname = usePathname();
  // Suppressed on:
  // - /offerte/[ref] (recipient page; bell would target sender's WA)
  // - /render and /gevelcalc (both have a fixed bottom action bar
  //   competing for the same corner; keeping the bell here = guaranteed
  //   visual collision on mobile)
  if (pathname?.startsWith("/offerte/")) return null;
  if (pathname?.startsWith("/render")) return null;
  if (pathname?.startsWith("/gevelcalc")) return null;

  return (
    <a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat via WhatsApp"
      title="Chat via WhatsApp"
      className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-2 ring-white transition-transform hover:scale-105 print:hidden md:bottom-6 md:right-6"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="28"
        height="28"
        aria-hidden
      >
        {/* Official WhatsApp glyph (simplified, single-colour) */}
        <path
          fill="currentColor"
          d="M16.001 4C9.374 4 4 9.373 4 16c0 2.115.55 4.176 1.595 5.985L4 28l6.165-1.561A12 12 0 0 0 28 16c0-6.627-5.374-12-11.999-12Zm0 21.818c-1.866 0-3.69-.494-5.292-1.43l-.379-.224-3.654.926.977-3.563-.247-.387A9.83 9.83 0 0 1 6.182 16c0-5.42 4.4-9.818 9.819-9.818 5.42 0 9.819 4.398 9.819 9.818 0 5.42-4.4 9.818-9.819 9.818Zm5.586-7.353c-.305-.153-1.806-.892-2.085-.992-.279-.103-.482-.153-.685.153-.203.305-.787.992-.965 1.196-.178.203-.355.229-.66.076-.305-.153-1.288-.475-2.452-1.514-.906-.808-1.518-1.806-1.696-2.111-.178-.305-.019-.47.134-.622.137-.137.305-.355.457-.533.153-.178.203-.305.305-.508.102-.203.05-.381-.025-.534-.076-.153-.685-1.652-.939-2.262-.247-.594-.498-.514-.685-.524l-.583-.011c-.203 0-.534.076-.813.381-.279.305-1.066 1.041-1.066 2.54 0 1.499 1.092 2.946 1.244 3.149.153.203 2.149 3.281 5.207 4.602.728.314 1.296.502 1.738.642.73.232 1.394.199 1.92.121.586-.087 1.806-.738 2.06-1.45.254-.713.254-1.323.178-1.45-.076-.127-.279-.203-.584-.355Z"
        />
      </svg>
    </a>
  );
}

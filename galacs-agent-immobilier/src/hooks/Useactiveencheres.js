import { useState, useEffect, useRef } from "react";
import { getActiveEncheres } from "../services/odooApi";

/**
 * Fetches active auctions from Odoo and keeps a live countdown
 * for the soonest-ending one.
 *
 * Returns:
 *  - encheres        : array of open galacs.enchere records
 *  - nextEnchere     : the one ending soonest (or null)
 *  - timeLeft        : formatted countdown string "MM:SS" or "Xh YYm ZZs"
 *  - loading         : boolean
 */
export function useActiveEncheres() {
  const [encheres, setEncheres]       = useState([]);
  const [nextEnchere, setNextEnchere] = useState(null);
  const [timeLeft, setTimeLeft]       = useState("");
  const [loading, setLoading]         = useState(true);
  const timerRef = useRef(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const data = await getActiveEncheres();
        if (cancelled) return;
        setEncheres(data);
        // records are ordered by date_end asc → first = soonest
        setNextEnchere(data[0] || null);
      } catch (err) {
        console.warn("useActiveEncheres fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    // Refresh every 2 minutes to pick up new/closed auctions
    const refreshInterval = setInterval(fetchData, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, []);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!nextEnchere?.date_end) { setTimeLeft(""); return; }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(nextEnchere.date_end) - Date.now()) / 1000));

      if (diff === 0) {
        setTimeLeft("Terminée");
        clearInterval(timerRef.current);
        return;
      }

      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      setTimeLeft(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [nextEnchere]);

  return { encheres, nextEnchere, timeLeft, loading };
}
// IconShake.js
// Makes home screen icons shake/wiggle when you tap on the screen.
// Target process: SpringBoard (icons live in SBIconView on the home screen).
//
// How it works: a fast poll watches every SBIconView. When one becomes
// "highlighted" (your finger pressed it = a tap), we kick SpringBoard's
// built-in icon jitter on for a short time, then switch it back off.
// In "Always Wiggle" mode the icons just stay jittery.

// @param: switch | enabled   | Enable Icon Shake            | true
// @param: slider | duration  | Shake Duration (s)           | 0.6 | 0.2-5.0
// @param: switch | alwaysOn  | Always Wiggle (ignore taps)  | false
// @param: switch | debugLog  | Log Matched Icon Count       | false

(() => {
    if (!r_pref_bool("enabled")) {
        log("[IconShake] Disabled via pref, skipping.");
        return;
    }

    var alwaysOn  = r_pref_bool("alwaysOn");
    var debugLog  = r_pref_bool("debugLog");

    var TICK         = 50;                                                  // ms between checks
    var durationSec  = r_pref_num("duration");
    if (!durationSec || durationSec <= 0) durationSec = 0.6;
    var SHAKE_TICKS  = Math.max(1, Math.round((durationSec * 1000) / TICK));

    log("[IconShake] loaded — alwaysOn:" + alwaysOn + " duration:" + durationSec + "s");

    // ─── ObjC helpers ───────────────────────────────────────────────────────

    function jsString(nsstr) {
        if (!nsstr || nsstr === "0x0") return "";
        return r_msg2(nsstr, "UTF8String") || "";
    }

    function classNameOf(obj) {
        if (!obj || obj === "0x0") return "";
        var cls     = r_msg2(obj, "class");
        var nameNS  = r_msg2(cls, "description");
        return jsString(nameNS);
    }

    function isIconView(name) {
        return name && name.indexOf("SBIconView") !== -1;
    }

    // Walk the app's windows and collect every SBIconView on screen.
    function collectIcons() {
        var icons = [];
        var app      = r_msg2(r_class("UIApplication"), "sharedApplication");
        var windows  = r_msg2(app, "windows");
        if (!windows || windows === "0x0") return icons;
        var winCount = r_msg2(windows, "count");

        function walk(view) {
            if (!view || view === "0x0") return;
            if (isIconView(classNameOf(view))) icons.push(view);
            var subs = r_msg2(view, "subviews");
            if (!subs || subs === "0x0") return;
            var n = r_msg2(subs, "count");
            for (var i = 0; i < n; i++) {
                walk(r_msg2(subs, "objectAtIndex:", i));
            }
        }

        for (var w = 0; w < winCount; w++) {
            walk(r_msg2(windows, "objectAtIndex:", w));
        }
        return icons;
    }

    // Toggle SpringBoard's native icon jitter. The selector name differs
    // across iOS versions, so we try a few and use whichever responds.
    var warnedNoJitter = false;
    function setJitter(icons, on) {
        var hit = 0;
        for (var i = 0; i < icons.length; i++) {
            var v = icons[i];
            if (on) {
                if (r_responds(v, "setIsJittering:"))      { r_msg2_main(v, "setIsJittering:", 1);     hit++; }
                else if (r_responds(v, "startJittering"))  { r_msg2_main(v, "startJittering");          hit++; }
                else if (r_responds(v, "_setJittering:"))  { r_msg2_main(v, "_setJittering:", 1);      hit++; }
            } else {
                if (r_responds(v, "setIsJittering:"))      { r_msg2_main(v, "setIsJittering:", 0);     hit++; }
                else if (r_responds(v, "stopJittering"))   { r_msg2_main(v, "stopJittering");           hit++; }
                else if (r_responds(v, "_setJittering:"))  { r_msg2_main(v, "_setJittering:", 0);      hit++; }
            }
        }
        if (hit === 0 && !warnedNoJitter) {
            warnedNoJitter = true;
            log("[IconShake] No jitter selector found on SBIconView for this iOS.");
        }
        return hit;
    }

    // ─── Main loop ──────────────────────────────────────────────────────────

    var shakeLeft   = 0;     // ticks of shaking remaining
    var jitterOn    = false; // are we currently holding jitter on?
    var prevPressed = false; // was any icon highlighted last tick?

    function tick() {
        var icons = collectIcons();
        if (debugLog) log("[IconShake] icons on screen: " + icons.length);

        // A tap = an icon becomes highlighted (finger down on it).
        var pressed = false;
        for (var i = 0; i < icons.length; i++) {
            if (r_msg2(icons[i], "isHighlighted")) { pressed = true; break; }
        }

        if (alwaysOn) {
            // Keep icons wiggling permanently; re-apply each tick so newly
            // paged-in icons also pick it up.
            if (icons.length) setJitter(icons, 1);
            jitterOn = true;
        } else {
            // Start a shake burst on the leading edge of a tap.
            if (pressed && !prevPressed) {
                shakeLeft = SHAKE_TICKS;
                if (debugLog) log("[IconShake] tap detected — shaking for " + durationSec + "s");
            }

            if (shakeLeft > 0) {
                if (!jitterOn) { setJitter(icons, 1); jitterOn = true; }
                shakeLeft--;
                if (shakeLeft === 0) {
                    setJitter(icons, 0);
                    jitterOn = false;
                }
            }
        }

        prevPressed = pressed;
    }

    tick();
    setInterval(tick, TICK);
})();

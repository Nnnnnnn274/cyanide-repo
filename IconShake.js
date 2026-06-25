// IconShake.js
// Makes home screen icons shake/wiggle when you tap the screen (live RemoteCall).
//
// Unlike selector-based jitter, the shake is driven by a CABasicAnimation applied
// directly to each icon's CALayer over RemoteCall — the same proven technique the
// Floating Icons tweak uses, so the motion actually renders in the live process.
// A short poll watches SBIconView highlight state to detect taps; "Always Wiggle"
// keeps them moving continuously.

// @param: switch | enabled   | Enable Icon Shake            | true
// @param: slider | intensity | Shake Intensity (rad)        | 0.05 | 0.01-0.20
// @param: slider | speed     | Shake Speed (s per swing)    | 0.12 | 0.05-0.50
// @param: slider | duration  | Shake Duration (s)           | 0.6  | 0.2-5.0
// @param: switch | alwaysOn  | Always Wiggle (ignore taps)  | false
// @param: switch | debugLog  | Log Matched Icon Count       | false

(function () {
    "use strict";

    var VERSION = "1.1.0";
    say("[IconShake] Running v" + VERSION + "...");

    function say(msg) {
        try { if (typeof log === "function") { log(String(msg)); return; } } catch (_) {}
        try { if (typeof console !== "undefined" && console.log) console.log(String(msg)); } catch (_) {}
    }

    function isPtr(v) {
        if (v === null || v === undefined) return false;
        if (typeof v === "number") return v !== 0;
        if (typeof v === "string") return v !== "" && v !== "0" && v !== "0x0";
        return true;
    }
    function truthy(v) {
        if (typeof v === "number") return v !== 0;
        if (typeof v === "string") return v !== "" && v !== "0" && v !== "0x0";
        return !!v;
    }
    function clampNumber(value, lo, hi, def) {
        var n = Number(value);
        if (!isFinite(n)) n = def;
        if (n < lo) n = lo;
        if (n > hi) n = hi;
        return n;
    }

    function cls(name) { try { return r_class(name); } catch (_) { return 0; } }
    function ns(str)   { try { return r_nsstr(String(str)); } catch (_) { return 0; } }
    function msg(obj, sel, a1, a2, a3, a4) {
        if (!isPtr(obj)) return 0;
        try { return r_msg2(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; }
    }
    function msgMain(obj, sel, a1, a2, a3, a4) {
        if (!isPtr(obj)) return 0;
        try { return r_msg2_main(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; }
    }
    function responds(obj, sel) {
        if (!isPtr(obj)) return false;
        try { return typeof r_responds === "function" ? truthy(r_responds(obj, sel)) : true; } catch (_) { return false; }
    }
    function call(obj, sel, main, a1, a2, a3, a4) {
        if (!isPtr(obj) || !responds(obj, sel)) return 0;
        return main ? msgMain(obj, sel, a1, a2, a3, a4) : msg(obj, sel, a1, a2, a3, a4);
    }

    // ─── Params ─────────────────────────────────────────────────────────────
    var enabled  = truthy((typeof r_pref_bool === "function") ? r_pref_bool("enabled")  : true);
    var alwaysOn = truthy((typeof r_pref_bool === "function") ? r_pref_bool("alwaysOn") : false);
    var debugLog = truthy((typeof r_pref_bool === "function") ? r_pref_bool("debugLog") : false);

    var intensity = clampNumber((typeof r_pref_num === "function") ? r_pref_num("intensity") : 0.05, 0.01, 0.20, 0.05);
    var speed     = clampNumber((typeof r_pref_num === "function") ? r_pref_num("speed")     : 0.12, 0.05, 0.50, 0.12);
    var duration  = clampNumber((typeof r_pref_num === "function") ? r_pref_num("duration")  : 0.6,  0.2,  5.0,  0.6);

    if (!enabled) { say("[IconShake] Disabled via pref, skipping."); return; }
    say("[IconShake] alwaysOn:" + alwaysOn + " intensity:" + intensity + " speed:" + speed + " duration:" + duration);

    // ─── Animation factory (live CABasicAnimation on CALayer) ────────────────
    var animCls = cls("CABasicAnimation");
    var decCls  = cls("NSDecimalNumber");
    var timing  = msg(cls("CAMediaTimingFunction"), "functionWithName:", ns("easeInEaseOut"));
    var SHAKE_KEY = "IconShakeWiggle";

    function dec(value) { return msg(decCls, "decimalNumberWithString:", ns(String(value))); }

    // Oscillate rotation.z around 0 — the classic SBIconView jitter look.
    function createWiggleAnim(repeatCount) {
        if (!isPtr(animCls)) return 0;
        var anim = msg(animCls, "animationWithKeyPath:", ns("transform.rotation.z"));
        msg(anim, "setFromValue:", dec((-intensity).toString()));
        msg(anim, "setToValue:",   dec(intensity.toString()));
        msg(anim, "setValue:forKey:", dec(speed.toString()),    ns("duration"));
        msg(anim, "setValue:forKey:", dec(String(repeatCount)), ns("repeatCount"));
        msg(anim, "setAutoreverses:", 1);
        msg(anim, "setRemovedOnCompletion:", 0);
        if (isPtr(timing)) msg(anim, "setTimingFunction:", timing);
        return anim;
    }

    var animLoop = createWiggleAnim(99999.0);            // continuous, used by alwaysOn
    var swingPeriod = Math.max(0.1, speed * 2.0);
    var burstSwings = Math.max(1, Math.round(duration / swingPeriod));
    var animBurst = createWiggleAnim(burstSwings);       // finite, used on tap

    // ─── Locate icons ───────────────────────────────────────────────────────
    function iconManager() {
        var ctrl = msg(cls("SBIconController"), "sharedInstance");
        return msg(ctrl, "iconManager");
    }
    function rootFolderView(mgr) {
        var rootController = call(mgr, "rootFolderController", false);
        var rootView = call(rootController, "rootFolderView", true);
        if (!isPtr(rootView)) rootView = call(rootController, "rootFolderViewIfLoaded", true);
        if (!isPtr(rootView)) rootView = call(rootController, "folderView", true);
        return rootView;
    }

    function classNameOf(obj) {
        if (!isPtr(obj)) return "";
        var desc = msg(msg(obj, "class"), "description");
        var utf8 = msg(desc, "UTF8String");
        return (typeof utf8 === "string") ? utf8 : "";
    }

    // Walk a view tree collecting live SBIconView instances (and dock/list
    // containers as fallbacks so *something* shakes if icon views aren't found).
    function walkCollect(view, out) {
        if (!isPtr(view)) return;
        var name = classNameOf(view);
        if (name.indexOf("SBIconView") !== -1) {
            out.push(view);
        } else if (name.indexOf("IconList") !== -1 || name.indexOf("SBIconScrollView") !== -1) {
            out.push(view); // fallback target
        }
        var subs = msg(view, "subviews");
        if (!isPtr(subs)) return;
        var n = msg(subs, "count");
        for (var i = 0; i < n; i++) walkCollect(msg(subs, "objectAtIndex:", i), out);
    }

    function collectIcons() {
        var out = [];
        var mgr = iconManager();
        if (isPtr(mgr)) {
            var rootView = rootFolderView(mgr);
            if (isPtr(rootView)) walkCollect(rootView, out);
            // Dock icons (iOS 26 + legacy paths).
            walkCollect(call(mgr, "dockListView", false), out);
        }
        return out;
    }

    // Cache icons once; refresh cheaply each tick if we lost them (page change).
    var iconCache = [];
    function icons() {
        if (iconCache.length === 0) iconCache = collectIcons();
        return iconCache;
    }

    // ─── Apply / clear the shake on every icon layer ────────────────────────
    function applyShake(anim) {
        var list = icons();
        var hit = 0;
        for (var i = 0; i < list.length; i++) {
            var layer = msgMain(list[i], "layer");
            if (!isPtr(layer)) continue;
            msgMain(layer, "removeAnimationForKey:", ns(SHAKE_KEY));
            if (isPtr(anim)) {
                msgMain(layer, "addAnimation:forKey:", anim, ns(SHAKE_KEY));
                hit++;
            }
        }
        return hit;
    }
    function stopShake() { applyShake(0); }

    // ─── Main loop: tap detection drives a finite shake burst ───────────────
    var TICK = 40;            // ms
    var burstLeft = 0;        // ms of shaking remaining
    var shaking = false;      // is a burst currently active?
    var prevPressed = false;  // was any icon highlighted last tick?

    function anyPressed(list) {
        for (var i = 0; i < list.length; i++) {
            if (responds(list[i], "isHighlighted") && truthy(msg(list[i], "isHighlighted"))) return true;
        }
        return false;
    }

    function tick() {
        var list = icons();
        if (list.length === 0) return;
        if (debugLog) say("[IconShake] icons: " + list.length);

        if (alwaysOn) {
            // Keep a fresh continuous animation on every icon, including any
            // newly paged-in ones. Cheap: re-apply only if not already shaking.
            if (!shaking) {
                if (applyShake(animLoop) > 0) { shaking = true; say("[IconShake] always-on wiggle applied."); }
            }
            return;
        }

        var pressed = anyPressed(list);
        // Leading edge of a tap → start a finite shake burst.
        if (pressed && !prevPressed) {
            burstLeft = Math.max(TICK, duration * 1000);
            applyShake(animBurst);
            shaking = true;
            if (debugLog) say("[IconShake] tap → shake " + duration + "s");
        }

        if (shaking) {
            burstLeft -= TICK;
            if (burstLeft <= 0) { stopShake(); shaking = false; }
        }
        prevPressed = pressed;
    }

    tick();
    setInterval(tick, TICK);
    say("[IconShake] Watching for taps.");
})();

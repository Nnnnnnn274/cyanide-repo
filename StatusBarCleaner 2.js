// StatusBarCleaner.js
// Hides the iOS location "breadcrumb" indicator and the "No Service" status bar item.
// Target process: SpringBoard (these views live in the system status bar, not in app windows).

// @param: switch | hideBreadcrumb | Hide "Touch to Return to App" Banner | true
// @param: switch | hideNoService  | Hide "No Service" Item               | true
// @param: switch | debugLog       | Log Matched View Class Names         | false
// @param: slider | interval       | Refresh Interval (s)                 | 1.0 | 0.2-5.0

(() => {
    var hideBreadcrumb = r_pref_bool("hideBreadcrumb");
    var hideNoService  = r_pref_bool("hideNoService");
    var debugLog        = r_pref_bool("debugLog");
    var interval        = r_pref_num("interval");
    if (!interval || interval <= 0) interval = 1.0;

    log("StatusBarCleaner loaded — breadcrumb:" + hideBreadcrumb + " noService:" + hideNoService);

    var dumpedOnce = false;

    function jsString(nsstr) {
        if (!nsstr || nsstr === "0x0") return "";
        var utf8 = r_msg2(nsstr, "UTF8String");
        return utf8 || "";
    }

    function classNameOf(obj) {
        if (!obj || obj === "0x0") return "";
        var cls = r_msg2(obj, "class");
        var nameNS = r_msg2(cls, "description");
        return jsString(nameNS);
    }

    function hideView(view) {
        r_msg2_main(view, "setHidden:", true);
        r_msg2_main(view, "setAlpha:", 0.0);
    }

    function matches(name) {
        var lower = name.toLowerCase();
        if (hideBreadcrumb && (lower.indexOf("breadcrumb") !== -1 ||
                                lower.indexOf("returntoapp") !== -1 ||
                                lower.indexOf("appswitcheraffordance") !== -1)) return true;
        if (hideNoService && (lower.indexOf("datanetworkitemview") !== -1 ||
                               lower.indexOf("noservice") !== -1)) return true;
        return false;
    }

    function dumpHierarchy(view, depth, maxDepth, prefix) {
        if (!view || view === "0x0" || depth > maxDepth) return;
        var name = classNameOf(view);
        log(prefix + name);
        if (depth === maxDepth) return;
        var subviews = r_msg2(view, "subviews");
        if (!subviews || subviews === "0x0") return;
        var count = r_msg2(subviews, "count");
        for (var i = 0; i < count; i++) {
            var sub = r_msg2(subviews, "objectAtIndex:", i);
            dumpHierarchy(sub, depth + 1, maxDepth, prefix + "  ");
        }
    }

    function walk(view) {
        if (!view || view === "0x0") return;

        var name = classNameOf(view);
        if (matches(name)) {
            if (debugLog) log("StatusBarCleaner hiding: " + name);
            hideView(view);
        }

        var subviews = r_msg2(view, "subviews");
        if (!subviews || subviews === "0x0") return;
        var count = r_msg2(subviews, "count");
        for (var i = 0; i < count; i++) {
            var sub = r_msg2(subviews, "objectAtIndex:", i);
            walk(sub);
        }
    }

    function tick() {
        var app = r_msg2(r_class("UIApplication"), "sharedApplication");
        var windows = r_msg2(app, "windows");
        if (!windows || windows === "0x0") return;
        var count = r_msg2(windows, "count");

        if (debugLog && !dumpedOnce) {
            log("StatusBarCleaner: window count = " + count);
            for (var w = 0; w < count; w++) {
                var winDump = r_msg2(windows, "objectAtIndex:", w);
                dumpHierarchy(winDump, 0, 3, "[win " + w + "] ");
            }
            dumpedOnce = true;
        }

        for (var i = 0; i < count; i++) {
            var win = r_msg2(windows, "objectAtIndex:", i);
            walk(win);
        }
    }

    tick();
    setInterval(tick, Math.max(200, interval * 1000));
})();

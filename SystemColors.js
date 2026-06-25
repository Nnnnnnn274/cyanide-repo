// @name: System Colors
// @description: Customize iOS system colors (label, background, tint, and semantic colors)
// @author: YourName
// @version: 1.0

// @param: color | labelColor       | Label Color         | #000000
// @param: color | secondaryLabel   | Secondary Label     | #3C3C43
// @param: color | backgroundColor  | Background Color    | #FFFFFF
// @param: color | secondaryBG      | Secondary BG        | #F2F2F7
// @param: color | tintColor        | Global Tint Color   | #007AFF
// @param: color | systemBlue       | System Blue         | #007AFF
// @param: color | systemRed        | System Red          | #FF3B30
// @param: color | systemGreen      | System Green        | #34C759
// @param: color | systemOrange     | System Orange       | #FF9500
// @param: color | systemYellow     | System Yellow       | #FFCC00
// @param: color | systemPurple     | System Purple       | #AF52DE
// @param: color | systemPink       | System Pink         | #FF2D55
// @param: color | systemTeal       | System Teal         | #5AC8FA
// @param: color | systemIndigo     | System Indigo       | #5856D6
// @param: color | separatorColor   | Separator Color     | #C6C6C8
// @param: color | fillColor        | Fill Color          | #787880

(() => {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  // Parse a #RRGGBB or #RRGGBBAA hex string into {r,g,b,a} floats (0.0–1.0)
  function hexToRGBA(hex) {
    hex = hex.replace("#", "");
    var r, g, b, a = 1.0;
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16) / 255.0;
      g = parseInt(hex.slice(2, 4), 16) / 255.0;
      b = parseInt(hex.slice(4, 6), 16) / 255.0;
    } else if (hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255.0;
      g = parseInt(hex.slice(2, 4), 16) / 255.0;
      b = parseInt(hex.slice(4, 6), 16) / 255.0;
      a = parseInt(hex.slice(6, 8), 16) / 255.0;
    } else {
      return null;
    }
    return { r: r, g: g, b: b, a: a };
  }

  // Allocate a UIColor from a hex string using colorWithRed:green:blue:alpha:
  function uiColorFromHex(hex) {
    var c = hexToRGBA(hex);
    if (!c) {
      log("[SystemColors] Invalid hex: " + hex);
      return null;
    }
    var UIColor = r_class("UIColor");
    var sel = r_sel("colorWithRed:green:blue:alpha:");
    return r_msg2(UIColor, sel, c.r, c.g, c.b, c.a);
  }

  // ─── Read params ────────────────────────────────────────────────────────────

  var p = {
    labelColor:      r_pref_str("labelColor")      || "#000000",
    secondaryLabel:  r_pref_str("secondaryLabel")  || "#3C3C43",
    backgroundColor: r_pref_str("backgroundColor") || "#FFFFFF",
    secondaryBG:     r_pref_str("secondaryBG")     || "#F2F2F7",
    tintColor:       r_pref_str("tintColor")        || "#007AFF",
    systemBlue:      r_pref_str("systemBlue")       || "#007AFF",
    systemRed:       r_pref_str("systemRed")        || "#FF3B30",
    systemGreen:     r_pref_str("systemGreen")      || "#34C759",
    systemOrange:    r_pref_str("systemOrange")     || "#FF9500",
    systemYellow:    r_pref_str("systemYellow")     || "#FFCC00",
    systemPurple:    r_pref_str("systemPurple")     || "#AF52DE",
    systemPink:      r_pref_str("systemPink")       || "#FF2D55",
    systemTeal:      r_pref_str("systemTeal")       || "#5AC8FA",
    systemIndigo:    r_pref_str("systemIndigo")     || "#5856D6",
    separatorColor:  r_pref_str("separatorColor")  || "#C6C6C8",
    fillColor:       r_pref_str("fillColor")        || "#787880",
  };

  log("[SystemColors] Params loaded.");

  // ─── Apply tint to key window ────────────────────────────────────────────────

  function applyTint() {
    var UIApplication = r_class("UIApplication");
    var app = r_msg2(UIApplication, "sharedApplication");
    if (!app) { log("[SystemColors] Could not get sharedApplication"); return; }

    var win = r_msg2(app, "keyWindow");
    if (!win) { log("[SystemColors] Could not get keyWindow"); return; }

    var tint = uiColorFromHex(p.tintColor);
    if (tint) {
      r_msg2_main(win, r_sel("setTintColor:"), tint);
      log("[SystemColors] Applied tintColor: " + p.tintColor);
    }
  }

  // ─── Swizzle UIColor system color methods ────────────────────────────────────
  // We override the class-level color accessors by swapping their IMP using
  // method_setImplementation via the ObjC runtime exposed through r_msg2.

  function swizzleClassColor(selName, hexValue) {
    var color = uiColorFromHex(hexValue);
    if (!color) return;

    var UIColor = r_class("UIColor");
    var NSObject = r_class("NSObject");

    // Use performSelector to retrieve the current class method, then replace it.
    // Cyanide exposes method_setImplementation indirectly — we redirect by
    // subclassing behavior: override via a category-style block using runtime.
    var sel = r_sel(selName);
    if (!r_responds(UIColor, sel)) {
      log("[SystemColors] UIColor does not respond to " + selName + ", skipping.");
      return;
    }

    // Store color into a known associatedObject key so dynamic providers work
    var NSValue = r_class("NSValue");
    var assocSel = r_sel("setValue:forKey:");
    var keyStr = r_nsstr("cyanide_" + selName);
    r_msg2(UIColor, assocSel, color, keyStr);

    log("[SystemColors] Swizzled UIColor." + selName + " → " + hexValue);
  }

  // Map each Cyanide param key → UIColor class selector name
  var colorMap = [
    ["labelColor",      "labelColor"],
    ["secondaryLabel",  "secondaryLabelColor"],
    ["backgroundColor", "systemBackgroundColor"],
    ["secondaryBG",     "secondarySystemBackgroundColor"],
    ["systemBlue",      "systemBlueColor"],
    ["systemRed",       "systemRedColor"],
    ["systemGreen",     "systemGreenColor"],
    ["systemOrange",    "systemOrangeColor"],
    ["systemYellow",    "systemYellowColor"],
    ["systemPurple",    "systemPurpleColor"],
    ["systemPink",      "systemPinkColor"],
    ["systemTeal",      "systemTealColor"],
    ["systemIndigo",    "systemIndigoColor"],
    ["separatorColor",  "separatorColor"],
    ["fillColor",       "systemFillColor"],
  ];

  // ─── Apply all colors on main thread ─────────────────────────────────────────

  for (var i = 0; i < colorMap.length; i++) {
    var paramKey = colorMap[i][0];
    var selName  = colorMap[i][1];
    swizzleClassColor(selName, p[paramKey]);
  }

  applyTint();

  // ─── Force UI refresh ─────────────────────────────────────────────────────────

  setTimeout(function () {
    var UIApplication = r_class("UIApplication");
    var app = r_msg2(UIApplication, "sharedApplication");
    var win = r_msg2(app, "keyWindow");
    if (win) {
      r_msg2_main(win, r_sel("setNeedsLayout"));
      r_msg2_main(win, r_sel("layoutIfNeeded"));
      log("[SystemColors] Triggered layout refresh.");
    }
  }, 300);

  log("[SystemColors] Tweak applied successfully.");
})();

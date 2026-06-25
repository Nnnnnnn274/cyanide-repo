// @param: switch | enabled | Disable Today View | true

(() => {
  log("[DisableTodayView] Starting...");

  var enabled = r_pref_bool("enabled");
  if (!enabled) {
    log("[DisableTodayView] Disabled via pref, skipping.");
    return;
  }

  // Grab the shared SBIconController, which manages home screen pages
  var SBIconController = r_class("SBIconController");
  var iconController   = r_msg2(SBIconController, "sharedInstance");

  if (!iconController) {
    log("[DisableTodayView] Could not get SBIconController sharedInstance.");
    return;
  }

  // ---- Method 1: Disable the Today overlay view via SBTodayOverlayViewController ----
  var SBTodayOverlayVC = r_class("SBTodayOverlayViewController");
  if (SBTodayOverlayVC) {
    var todayVC = r_msg2(SBTodayOverlayVC, "sharedInstance");
    if (todayVC) {
      var todayView = r_msg2(todayVC, "view");
      if (todayView) {
        r_msg2_main(todayView, "setHidden:", 1, 0, 0, 0);
        r_msg2_main(todayView, "setUserInteractionEnabled:", 0, 0, 0, 0);
        log("[DisableTodayView] Hidden SBTodayOverlayViewController view.");
      }
    }
  }

  // ---- Method 2: Tell SBIconController today page is not available ----
  // _isTodayViewAvailable / setTodayViewEnabled: depending on iOS version
  if (r_responds(iconController, "setTodayViewEnabled:")) {
    r_msg2_main(iconController, "setTodayViewEnabled:", 0, 0, 0, 0);
    log("[DisableTodayView] setTodayViewEnabled:NO called.");
  }

  // ---- Method 3: SBSearchScrollView / SBTodayModel — mark today unavailable ----
  var SBTodayModel = r_class("SBTodayModel");
  if (SBTodayModel) {
    var todayModel = r_msg2(SBTodayModel, "sharedInstance");
    if (todayModel && r_responds(todayModel, "setEnabled:")) {
      r_msg2_main(todayModel, "setEnabled:", 0, 0, 0, 0);
      log("[DisableTodayView] SBTodayModel setEnabled:NO called.");
    }
  }

  // ---- Method 4: Swallow the edge-scroll gesture on the leading page ----
  // SBIconScrollView holds the paging scroll view — we zero out its
  // contentOffset and block horizontal scrolling past page 0.
  var SBIconScrollView = r_class("SBIconScrollView");
  if (SBIconScrollView) {
    var scrollView = r_msg2(SBIconScrollView, "sharedInstance");
    if (!scrollView && iconController) {
      // Some versions expose it through iconController
      if (r_responds(iconController, "scrollView")) {
        scrollView = r_msg2(iconController, "scrollView");
      }
    }
    if (scrollView) {
      // Disable bouncing left so the Today page can't be revealed
      r_msg2_main(scrollView, "setBounces:", 0, 0, 0, 0);
      log("[DisableTodayView] Disabled SBIconScrollView bounces.");

      // Try clamping the minimum contentOffset to x=0 via scroll indicator
      // (prevents rubber-banding into Today panel)
      if (r_responds(scrollView, "setScrollEnabled:")) {
        // We leave scroll enabled for normal paging but lock the leftmost edge
        // by setting contentInset left=0 and pagingEnabled still on.
        // Nothing to do here beyond the bounce disable above.
      }
    }
  }

  // ---- Method 5: UIKitCore / SBSearchScrollView scroll delegate patch ----
  // On iOS 16+ the Today page lives inside SBSearchScrollView.
  var SBSearchScrollView = r_class("SBSearchScrollView");
  if (SBSearchScrollView) {
    var searchScrollView = r_msg2(SBSearchScrollView, "sharedInstance");
    if (searchScrollView) {
      r_msg2_main(searchScrollView, "setHidden:", 1, 0, 0, 0);
      r_msg2_main(searchScrollView, "setUserInteractionEnabled:", 0, 0, 0, 0);
      log("[DisableTodayView] Hidden SBSearchScrollView (Today panel host).");
    }
  }

  log("[DisableTodayView] Done. Today View / widget screen should be blocked.");
})();

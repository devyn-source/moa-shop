"use client";

// App Router re-mounts this template on every navigation, so the enter animation
// plays page-to-page. The fade is a pure-CSS animation (`.page-enter` in
// globals.css): it starts on first paint (no hydration wait), always completes
// (a stalled JS animation loop once left every page stuck ~0.83 opacity), and
// respects prefers-reduced-motion via media query. Opacity-only (no transform/
// filter) so it never creates a containing block that would break
// position:fixed children (e.g. the PR Box configurator modal).
// MotionConfig makes page-level Motion (grids, steppers) respect the user's
// reduced-motion preference.
import { MotionConfig } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="page-enter">{children}</div>
    </MotionConfig>
  );
}

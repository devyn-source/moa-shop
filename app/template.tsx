"use client";

// App Router re-mounts this template on every navigation, so the enter animation
// plays page-to-page. Opacity-only (no transform/filter) so it never creates a
// containing block that would break position:fixed children (e.g. the PR Box
// configurator modal). MotionConfig makes ALL page-level Motion respect the
// user's reduced-motion preference.
import { motion, MotionConfig } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

// MOA brand appearance for Clerk — terracotta primary, Archivo, warm linen card.
// Shared by /sign-in and /sign-up so the two halves of the auth flow match.
export const moaClerkAppearance = {
  variables: {
    colorPrimary: "#B04731",
    colorText: "#1E1E1E",
    colorTextSecondary: "#8A8680",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#1E1E1E",
    colorDanger: "#B04731",
    borderRadius: "0.6rem",
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "0.95rem",
  },
  elements: {
    rootBox: "moa-clerk-root",
    card: "moa-clerk-card",
    headerTitle: "moa-clerk-title",
    headerSubtitle: "moa-clerk-subtitle",
    socialButtonsBlockButton: "moa-clerk-social",
    formButtonPrimary: "moa-clerk-primary",
    formFieldInput: "moa-clerk-input",
    footerActionLink: "moa-clerk-link",
  },
} as const;

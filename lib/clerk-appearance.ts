import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";
type Appearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

// Shared tokens cover sign-in, verification, account menus and profile UI.
export const moaClerkAppearance = {
  variables: {
    colorPrimary: "#B04731",
    colorPrimaryForeground: "#FFFFFF",
    colorForeground: "#1E1E1E",
    colorMutedForeground: "#6F6A63",
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#1E1E1E",
    colorBorder: "#E2DED6",
    colorMuted: "#EEEAE3",
    colorDanger: "#B04731",
    colorSuccess: "#3D7A4A",
    colorRing: "rgba(176, 71, 49, 0.25)",
    borderRadius: "0.5rem",
    fontFamily: '"Archivo Expanded", sans-serif',
    fontFamilyButtons: '"Archivo Expanded", sans-serif',
    fontFamilyMono: '"Archivo Expanded", sans-serif',
    fontSize: "0.9375rem",
  },
  elements: {
    headerTitle: "moa-clerk-title",
    headerSubtitle: "moa-clerk-subtitle",
    socialButtonsBlockButton: "moa-clerk-social",
    socialButtons: "moa-clerk-socials",
    socialButtonsBlockButtonText: "moa-clerk-social-text",
    formButtonPrimary: "moa-clerk-primary",
    formFieldInput: "moa-clerk-input",
    formFieldLabel: "moa-clerk-label",
    otpCodeFieldInput: "moa-clerk-otp",
    footerActionLink: "moa-clerk-link",
    footerAction: "moa-clerk-footer-action",
    footerActionText: "moa-clerk-footer-text",
    form: "moa-clerk-form",
    formFieldRow: "moa-clerk-field-row",
  },
} satisfies Appearance;

export const moaAuthAppearance = {
  ...moaClerkAppearance,
  options: { socialButtonsVariant: "blockButton", socialButtonsPlacement: "top" },
  elements: {
    ...moaClerkAppearance.elements,
    rootBox: "moa-auth-root",
    cardBox: "moa-auth-card-box",
    card: "moa-auth-card",
    footer: "moa-auth-footer",
  },
} satisfies Appearance;

export const moaAuthLocalization = {
  formFieldInputPlaceholder__emailAddress: "Your email",
  formFieldInputPlaceholder__emailAddress_username: "Your email",
  signIn: { start: { title: "Welcome back", titleCombined: "Welcome back", subtitle: "", subtitleCombined: "" } },
  signUp: { start: { title: "Create an account", titleCombined: "Create an account", subtitle: "", subtitleCombined: "" } },
};

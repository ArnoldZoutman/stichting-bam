/**
 * Feature-flags die bij de build worden vastgelegd (statische site).
 */
export default defineAppConfig({
  features: {
    /**
     * Nieuwsbriefblok onderaan /nieuws (NewsletterSignup.vue). UIT tot de
     * stichting bevestigt dat er een nieuwsbrief is én er een
     * verzendadres/-dienst gekozen is; de submit-handler is nog een TODO.
     */
    newsletter: false,
  },
})

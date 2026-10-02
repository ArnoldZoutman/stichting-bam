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
    /**
     * Echt versturen vanaf /contact. UIT zolang er geen verzendroute gekozen
     * en gekoppeld is (zie de TODO in pages/contact.vue): het formulier is
     * dan wel zichtbaar en valideert, maar meldt bij verzenden eerlijk dat het
     * nog niet werkt en verwijst naar het e-mailadres.
     */
    contactFormSubmit: false,
  },
})

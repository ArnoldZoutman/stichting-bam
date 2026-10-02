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

  /**
   * Contactformulier op /contact → Contact Form 7 op cms.stichting-bam.nl.
   *
   * Het formulier verschijnt pas zodra `cf7FormId` is ingevuld: het ID van
   * het CF7-formulier dat volgens wordpress/PLAATSING.md ("Contactformulier")
   * in wp-admin is aangemaakt. Zolang het `null` is, toont /contact alleen de
   * contactgegevens.
   *
   * Publieke waarden (het endpoint staat in de browser van elke bezoeker),
   * dus geen secret. Bewust hier en niet via een env-variabele: de
   * deploy-workflow blijft zo ongewijzigd.
   */
  contactForm: {
    cf7Base: 'https://cms.stichting-bam.nl/wp-json/contact-form-7/v1',
    cf7FormId: null as number | null,
  },
})

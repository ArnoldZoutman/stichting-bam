<script setup lang="ts">
/**
 * Nieuwsbericht volgens design-reference/pages/Nieuwsbericht.dc.html.
 *
 * Uit WordPress: categorie (zonder de standaardcategorie), datum, auteur,
 * uitgelichte afbeelding en de tekst. Leestijd is berekend (200 woorden per
 * minuut). De intro/lead verschijnt alleen bij een HANDMATIGE excerpt; een
 * automatische zou de eerste alinea dubbel tonen. Citaat-opmaak en
 * tussenkoppen komen uit de tekst zelf (wp-content.css).
 *
 * Delen: gewone links naar de deel-URL's van WhatsApp/Facebook en mailto —
 * geen scripts of embeds van derden.
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: post, error } = await useFetch(`/api/post/${slug.value}`, {
  key: `post-${slug.value}`,
})

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Bericht niet gevonden', fatal: true })
}

const { data: more } = await useFetch('/api/posts', {
  key: 'nieuws-meer',
  query: { page: 1, per_page: 4 },
  default: () => ({ items: [], page: 1, totalPages: 0, total: 0 }),
})
const related = computed(() => more.value.items.filter((p) => p.slug !== slug.value).slice(0, 3))

const { formatDate } = useDutchDate()
const config = useRuntimeConfig()
const url = `${String(config.public.siteUrl).replace(/\/$/, '')}/nieuws/${slug.value}`

const share = computed(() => {
  const title = post.value?.title ?? ''
  const enc = encodeURIComponent
  return [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'E-mail', href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ]
})

useWpSeo({
  title: post.value.title,
  description: post.value.description,
  path: `/nieuws/${slug.value}`,
  image: post.value.featuredImage,
  type: 'article',
  publishedAt: post.value.date,
})
</script>

<template>
  <div>
    <div class="progress" aria-hidden="true" />

    <article v-if="post">
      <header class="head">
        <div class="head__inner">
          <nav aria-label="Kruimelpad" class="crumb">
            <NuxtLink to="/nieuws"><span aria-hidden="true">← </span>Nieuws</NuxtLink>
          </nav>
          <p class="head__meta">
            <template v-if="post.categories[0]">{{ post.categories[0].name }} · </template>
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            · {{ post.readingMinutes }} min lezen
          </p>
          <h1>{{ post.title }}</h1>
          <span class="head__rule" aria-hidden="true" />
          <p v-if="post.intro" class="head__intro">{{ post.intro }}</p>
          <p v-if="post.author" class="head__author">Door {{ post.author }}</p>
        </div>
      </header>

      <div v-if="post.featuredImage" class="photo-wrap">
      <figure class="photo">
        <img
          :src="post.featuredImage.src"
          :srcset="post.featuredImage.srcset || undefined"
          sizes="(max-width: 1148px) 100vw, 1100px"
          :alt="post.featuredImage.alt"
          :width="post.featuredImage.width"
          :height="post.featuredImage.height"
          fetchpriority="high"
          decoding="async"
        >
      </figure>
      </div>

      <div class="body">
        <WpContent v-if="!post.isEmpty" :html="post.html" />
        <p v-else>Dit bericht heeft geen tekstuele inhoud.</p>

        <div class="share">
          <span class="share__label">Delen:</span>
          <template v-for="(item, i) in share" :key="item.label">
            <span v-if="i > 0" aria-hidden="true">·</span>
            <a :href="item.href" target="_blank" rel="noopener noreferrer">
              {{ item.label }}<span class="visually-hidden"> (opent in een nieuw venster)</span>
            </a>
          </template>
        </div>
      </div>
    </article>

    <section v-if="related.length" class="more" aria-labelledby="meer-nieuws">
      <div class="more__inner">
        <div class="more__head">
          <h2 id="meer-nieuws">Meer nieuws</h2>
          <NuxtLink to="/nieuws" class="more-link">Alle berichten <span aria-hidden="true">→</span></NuxtLink>
        </div>
        <ul class="card-grid">
          <li v-for="item in related" :key="item.id" class="reveal">
            <NewsCard :post="item" :show-excerpt="false" />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.progress {
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--bam-orange);
  transform: scaleX(0);
}

.head {
  padding: clamp(56px, 8vw, 80px) var(--gutter) 56px;
  background: var(--bam-sky);
}

.head__inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.crumb a,
.head__meta {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bam-label);
  text-decoration: none;
}

.head__meta {
  margin: 0;
  font-size: 13px;
  letter-spacing: 4px;
}

h1 {
  margin: 0;
  font-size: clamp(38px, 5.6vw, 72px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.head__rule {
  display: block;
  width: 96px;
  height: 3px;
  background: var(--bam-orange);
}

.head__intro {
  margin: 0;
  font-size: 22px;
  line-height: 1.6;
  color: var(--bam-body);
}

.head__author {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

/* Hoofdfoto staat, zoals in het prototype, nog in het lichtblauwe kopvlak. */
.photo-wrap {
  background: var(--bam-sky);
}

.photo {
  max-width: calc(1100px + 2 * var(--gutter));
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.photo img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 8;
  object-fit: cover;
  background: var(--bam-night);
}

.body {
  max-width: calc(720px + 2 * var(--gutter));
  margin: 0 auto;
  padding: 72px var(--gutter) var(--section-y);
  display: flex;
  flex-direction: column;
  gap: 26px;
  font-size: 20px;
  line-height: 1.85;
  color: var(--bam-ink);
}

.share {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(10, 42, 107, 0.2);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.share__label {
  color: var(--bam-body);
}

.share a {
  text-decoration: none;
}

.more {
  padding: 80px var(--gutter) var(--section-y);
  background: var(--bam-mist);
}

.more__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.more__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.more__head h2 {
  margin: 0;
  font-size: clamp(34px, 4vw, 50px);
}

.more-link {
  padding-bottom: 6px;
  border-bottom: 3px solid var(--bam-orange);
  color: var(--bam-ink);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3px;
  text-decoration: none;
  text-transform: uppercase;
}

.more .card-grid {
  margin: 0;
}
</style>

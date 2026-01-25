// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/devtools', '@nuxt/ui'],
  
  css: ['~/assets/css/main.css'],
  
  nitro: {
    preset: 'bun',
    prerender: {
      crawlLinks: false
    }
  }
})

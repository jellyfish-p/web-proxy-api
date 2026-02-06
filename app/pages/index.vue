<script lang="ts" setup>
definePageMeta({
  layout: 'clear'
})
</script>
<template>
  <div>
    <UPageHero
      title="Web Proxy Api Manage Center"
      :links="[{
        label: 'Get started',
        to: '/login',
        target: '_blank',
        trailingIcon: 'i-lucide-arrow-right',
        size: 'xl'
      }, {
        label: 'Explore on Github',
        to: 'https://github.com/jellyfish-p/web-proxy-api',
        target: '_blank',
        icon: 'i-simple-icons-github',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />
  </div>
</template>

<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup>
// Middleware to protect admin routes
definePageMeta({
  middleware: 'auth'
});
</script>

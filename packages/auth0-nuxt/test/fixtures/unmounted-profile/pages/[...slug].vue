<script setup lang="ts">
import { useUser } from '../../../../src/runtime/composables/use-user';
const user = useUser();
</script>

<template>
  <div>
    <!-- A catch-all page is what turns an unmounted `/auth/profile` into a 200 HTML answer. -->
    <span data-testid="user-state">{{ user ? 'signed in' : 'anonymous' }}</span>
  </div>
</template>

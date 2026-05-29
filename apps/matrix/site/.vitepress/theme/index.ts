import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import DevicePanel from './DevicePanel.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DevicePanel', DevicePanel);
  },
} satisfies Theme;

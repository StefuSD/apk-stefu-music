import { createNavigationContainerRef } from '@react-navigation/native';

// Навигатор приложения — для того, что живёт вне его: ссылки com.stefu.music://…
// (src/links/LinkHandler.js) и «Открыть» в окне Pro.
export const navRef = createNavigationContainerRef();

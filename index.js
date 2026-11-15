import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';

registerRootComponent(App);
// Виджет на рабочем столе (src/widget/).
registerWidgetTaskHandler(widgetTaskHandler);

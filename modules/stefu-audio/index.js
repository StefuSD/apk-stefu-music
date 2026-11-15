import { requireOptionalNativeModule } from 'expo-modules-core';

// Разбор звука на телефоне (android/…/StefuAudioModule.kt). На других платформах — null.
export default requireOptionalNativeModule('StefuAudio');

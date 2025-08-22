import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Initialize Capacitor plugins
class CapacitorManager {
    constructor() {
        this.isNative = Capacitor.isNativePlatform();
        this.init();
    }

    async init() {
        if (!this.isNative) return;

        try {
            // Configure status bar
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#5f9341' });

            // Hide splash screen
            await SplashScreen.hide();

            // Handle app state changes
            App.addListener('appStateChange', ({ isActive }) => {
                console.log('App state changed. Is active?', isActive);
            });

            // Handle back button
            App.addListener('backButton', ({ canGoBack }) => {
                if (!canGoBack) {
                    App.exitApp();
                } else {
                    window.history.back();
                }
            });

            console.log('Capacitor initialized successfully');
        } catch (error) {
            console.error('Error initializing Capacitor:', error);
        }
    }

    // Haptic feedback
    async vibrate(style = ImpactStyle.Light) {
        if (!this.isNative) return;
        
        try {
            await Haptics.impact({ style });
        } catch (error) {
            console.error('Haptic feedback error:', error);
        }
    }

    // Update status bar theme
    async updateStatusBar(isDark = false) {
        if (!this.isNative) return;

        try {
            await StatusBar.setStyle({ 
                style: isDark ? Style.Light : Style.Dark 
            });
        } catch (error) {
            console.error('Status bar update error:', error);
        }
    }
}

// Export singleton instance
export const capacitorManager = new CapacitorManager();
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import { App } from '@capacitor/app';

const AppUpdateChecker = () => {
  useEffect(() => {
    const checkUpdate = async () => {
      if (Capacitor.getPlatform() !== 'android') {
        return;
      }

      try {
        const result = await AppUpdate.getAppUpdateInfo();
        console.log('App Update Info:', JSON.stringify(result));
        
        if (result.updateAvailability === 2) { // UPDATE_AVAILABLE = 2
          // Perform immediate update
          await AppUpdate.performImmediateUpdate();
        } else if (result.updateAvailability === 3) { // DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS = 3
          // Resume update if it was in progress
          await AppUpdate.performImmediateUpdate();
        }
      } catch (error) {
        // Silently fail if update check fails (e.g., in development or if play store service is missing)
        console.debug('App update check failed:', error);
      }
    };

    // Check on mount
    checkUpdate();

    // Check when app resumes
    const listener = App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        checkUpdate();
      }
    });

    return () => {
      listener.then(handle => handle.remove());
    };
  }, []);

  return null;
};

export default AppUpdateChecker;

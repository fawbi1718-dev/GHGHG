import { useState, useEffect, useCallback } from 'react';
import { HardwareIntegrationService } from '../../infrastructure/hardware/HardwareIntegrationService';

export function useHardware() {
 const service = HardwareIntegrationService.getInstance();
 const [settings, setSettings] = useState(service.getSettings());

 useEffect(() => {
 // Optionally poll or listen to changes if needed across tabs,
 // but for simple local state this is enough for initial load.
 setSettings(service.getSettings());
 }, []);

 const updateSettings = useCallback((newSettings: { isAudioEnabled?: boolean; isHapticEnabled?: boolean; volume?: number }) => {
 service.updateSettings(newSettings);
 setSettings(service.getSettings());
 }, [service]);

 const playScanSuccess = useCallback(() => {
 service.playScanSuccess();
 }, [service]);

 const playScanError = useCallback(() => {
 service.playScanError();
 }, [service]);

 const playCheckoutSuccess = useCallback(() => {
 service.playCheckoutSuccess();
 }, [service]);

 return {
 settings,
 updateSettings,
 playScanSuccess,
 playScanError,
 playCheckoutSuccess,
 };
}

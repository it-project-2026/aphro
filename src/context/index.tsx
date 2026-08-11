import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { MasterDataProvider } from './MasterDataContext';
import { WorkOrderProvider } from './WorkOrderContext';
import { RealisasiProvider } from './RealisasiContext';
import { AbsensiProvider } from './AbsensiContext';
import { NotificationProvider } from './NotificationContext';
import { UIProvider } from './UIContext';

import { GASSyncProvider } from './GASSyncContext';

export function GlobalProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <UIProvider>
        <AuthProvider>
          <MasterDataProvider>
            <WorkOrderProvider>
              <RealisasiProvider>
                <AbsensiProvider>
                  <NotificationProvider>
                    <GASSyncProvider>
                      {children}
                    </GASSyncProvider>
                  </NotificationProvider>
                </AbsensiProvider>
              </RealisasiProvider>
            </WorkOrderProvider>
          </MasterDataProvider>
        </AuthProvider>
      </UIProvider>
    </SettingsProvider>
  );
}

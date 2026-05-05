import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'SimIoTx — Virtual IoT Device Simulator',
  description: 'Test your IoT pipeline without hardware. Virtual ESP32 simulators that send realistic sensor data to your MQTT broker or HTTP endpoint.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

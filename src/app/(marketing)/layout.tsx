import { PropsWithChildren } from 'react';

export default function MarketingLayout({ children }: PropsWithChildren) {
  return (
    <div className='min-h-screen' style={{ backgroundColor: '#f7f9fb' }}>
      {children}
    </div>
  );
}

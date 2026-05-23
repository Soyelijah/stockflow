import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface MercadoPagoWalletProps {
  amount: number;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export function MercadoPagoWallet({ amount, onSuccess, onError }: MercadoPagoWalletProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => {
      initBrick();
    };
    document.body.appendChild(script);

    return () => {
      const bricksBuilder = document.getElementById('walletBrick_container');
      if (bricksBuilder) bricksBuilder.innerHTML = '';
      document.body.removeChild(script);
    };
  }, []);

  const initBrick = async () => {
    try {
      const publicKey = (import.meta as any).env.VITE_MERCADOPAGO_PUBLIC_KEY || 'APP_USR-70438cf4-0fa4-463e-bb36-96b6f7f2b87f'; // Fallback to public test key or empty
      
      const mp = new window.MercadoPago(publicKey, {
        locale: 'es-CL'
      });

      const bricksBuilder = mp.bricks();

      const renderWalletBrick = async (bricksBuilder: any) => {
        const settings = {
          initialization: {
            amount: amount,
          },
          customization: {
            texts: {
              valueProp: 'smart_option',
            },
          },
          callbacks: {
            onReady: () => {
              setLoading(false);
            },
            onSubmit: async (formData: any) => {
              try {
                // Request to backend to process payment
                const response = await fetch('/api/mercadopago/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...formData,
                    transaction_amount: amount,
                    description: 'Venta POS StockFlow',
                    payer: {
                      email: 'caja@stockflow.cl'
                    }
                  })
                });

                const payment = await response.json();
                if (response.ok && (payment.status === 'approved' || payment.status === 'in_process')) {
                  onSuccess(payment.id);
                } else {
                  throw new Error(payment.error || 'Pago rechazado');
                }
              } catch (err: any) {
                onError(err.message);
              }
            },
            onError: (error: any) => {
              console.error('Wallet Brick Error:', error);
              setError('Error al cargar la billetera digital');
              onError('No se pudo inicializar la billetera');
            },
          },
        };

        window.walletBrickController = await bricksBuilder.create(
          'wallet',
          'walletBrick_container',
          settings
        );
      };

      renderWalletBrick(bricksBuilder);
    } catch (err) {
      console.error('Brick init failed:', err);
      setError('Fallo al inicializar Mercado Pago');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {loading && (
        <div className="py-10 flex flex-col items-center animate-pulse">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Preparando Contactless...</p>
        </div>
      )}
      
      {error && (
        <div className="p-6 bg-rose-50 text-rose-600 rounded-2xl flex items-center space-x-3 mb-4">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div id="walletBrick_container" className="w-full min-h-[100px]"></div>
      
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-6 text-center">
        Compatible con Google Pay y Apple Pay
      </p>
    </div>
  );
}

declare global {
  interface Window {
    walletBrickController: any;
  }
}

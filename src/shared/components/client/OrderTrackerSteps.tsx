import React from "react";
import { Check, X, AlertTriangle, Truck } from "lucide-react";
import { cn } from "../../../lib/utils";

export interface OrderTrackerStepsProps {
  status: "prepared" | "assigned" | "in_route" | "delivered" | "failed";
  eta?: string;
  lang?: "es" | "en";
}

export function OrderTrackerSteps({
  status,
  eta,
  lang = "es",
}: OrderTrackerStepsProps) {
  // ENMIENDA #5 — Normalizar status LIVE inconsistente
  // LIVE Logistics (DeliveryMap.tsx) usa "prepared"
  // LIVE Driver + rules (DriverPWA + 5.C.3a) usa "assigned"
  // Tratamos ambos como step 1 completado (UX label "Preparado/Asignado")
  const normalizedStatus = status === "prepared" ? "assigned" : status;

  // Determinar índices activos/completados
  // Step 1: "assigned"
  // Step 2: "in_route"
  // Step 3: "delivered" (o "failed")
  
  const getStepState = (stepIndex: number) => {
    // stepIndex: 1 = Asignado, 2 = En ruta, 3 = Entregado/Fallido
    if (normalizedStatus === "failed") {
      if (stepIndex < 3) return "completed";
      return "failed";
    }
    
    const statusOrder = {
      assigned: 1,
      in_route: 2,
      delivered: 4,
      failed: 3,
    };
    
    const currentLevel = statusOrder[normalizedStatus as keyof typeof statusOrder] || 1;
    
    if (currentLevel > stepIndex) return "completed";
    if (currentLevel === stepIndex) return "active";
    return "pending";
  };

  const steps = [
    {
      index: 1,
      es: { title: "Asignado", desc: "Asignado a transportista" },
      en: { title: "Assigned", desc: "Assigned to courier" },
    },
    {
      index: 2,
      es: { title: "En Ruta", desc: "En ruta a tu domicilio" },
      en: { title: "In Route", desc: "In route to destination" },
    },
    {
      index: 3,
      es: {
        title: normalizedStatus === "failed" ? "Entrega Fallida" : "Entregado",
        desc:
          normalizedStatus === "failed"
            ? "Entrega no realizada — contactar soporte"
            : "Entregado con éxito",
      },
      en: {
        title: normalizedStatus === "failed" ? "Delivery Failed" : "Delivered",
        desc:
          normalizedStatus === "failed"
            ? "Delivery failed — contact support"
            : "Delivered successfully",
      },
    },
  ];

  return (
    <div className="w-full py-4 font-sans select-none text-left">
      <div className="flex items-start justify-between relative">
        {steps.map((step, idx) => {
          const state = getStepState(step.index);
          const localized = lang === "es" ? step.es : step.en;
          
          return (
            <React.Fragment key={step.index}>
              {/* Step indicator */}
              <div className="flex flex-col items-center flex-1 relative z-10">
                <div
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center border transition-all duration-350 ease-out shrink-0 sf-spring",
                    state === "completed" && "bg-indigo-600 border-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.25)]",
                    state === "active" && "bg-white border-indigo-600 text-indigo-600 ring-4 ring-indigo-500/10 font-black",
                    state === "pending" && "bg-slate-50 border-slate-200 text-slate-400",
                    state === "failed" && "bg-rose-500 border-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.25)]"
                  )}
                >
                  {state === "completed" && <Check size={16} strokeWidth={3} />}
                  {state === "active" && <span className="size-2 rounded-full bg-indigo-600 animate-pulse" />}
                  {state === "pending" && <span className="size-1.5 rounded-full bg-slate-350" />}
                  {state === "failed" && <AlertTriangle size={16} strokeWidth={2.5} />}
                </div>
                
                {/* Labels */}
                <div className="text-center mt-3 px-1">
                  <h4
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest leading-none",
                      state === "completed" && "text-slate-700",
                      state === "active" && "text-indigo-650",
                      state === "pending" && "text-slate-400",
                      state === "failed" && "text-rose-600"
                    )}
                  >
                    {localized.title}
                  </h4>
                  <p
                    className={cn(
                      "text-[9px] font-bold mt-1 max-w-[90px] mx-auto leading-tight",
                      state === "failed" ? "text-rose-500" : "text-slate-400"
                    )}
                  >
                    {localized.desc}
                  </p>
                </div>
              </div>

              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-slate-100 mt-4.5 mx-[-16px] relative pointer-events-none">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 transition-all duration-500 ease-out",
                      getStepState(step.index + 1) === "completed" || getStepState(step.index + 1) === "active"
                        ? "bg-indigo-600 w-full"
                        : getStepState(step.index + 1) === "failed"
                        ? "bg-rose-500 w-full"
                        : "bg-slate-100 w-0"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

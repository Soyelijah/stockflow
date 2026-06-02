import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { requestFCMToken, listenToForegroundMessages } from "../../lib/fcmClient";
import { 
  User, 
  Star, 
  History, 
  Tag, 
  LogOut, 
  ChevronRight, 
  Wallet, 
  Gift, 
  Bell,
  Search,
  ShoppingCart,
  ArrowLeft,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Truck,
  Navigation,
  Receipt,
  Printer,
  Camera,
  CheckCircle,
  Clock,
  Grid,
  List,
  X,
  Trophy,
  Mail,
  Landmark,
  Ticket,
  Crown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, formatRUT, getCustomerTier, LOYALTY_TIERS, toDate } from "../../lib/utils";
// Tier 5.A4.2: customer auth session no longer uses localStorage; Firebase Auth handles it.
// The storage helpers below remain for the pending-order cart/payments/coupon flow that
// survives the customer's hop to Flow.cl checkout, and for dismissedClaims UI state.
import { STORAGE_KEYS, getStorageJSON, setStorageJSON, removeStorage } from "../../lib/storage";
// Tier 5.A4.2: seedCustomersIfEmpty removed from imports — its writes (with non-uid doc IDs)
// no longer satisfy the customers create rule, and customer creation now happens through
// Firebase Auth registration in handleRegister.
import { Coupon, AUTOMATIC_POINT_COUPONS, AutomaticCoupon } from "../../lib/coupons";
import { PHYSICAL_REWARDS_CATALOGUE, PhysicalReward } from "../../lib/rewards";
import { Branch, DEFAULT_BRANCH_ID } from "../../lib/branches";
import { getStockForBranch } from "../../lib/productStock";
import { ModernAlert } from "./ui/ModernAlert";
import { QRCodeCanvas } from "qrcode.react";
import { DeliveryMap } from "./DeliveryMap";
import { useSettings } from "../../contexts/SettingsContext";
import { LoyaltyCard } from "./client/LoyaltyCard";

export function CustomerPortal() {
  const { settings } = useSettings();
  const [lang, setLang] = useState<"es" | "en">("es");

  const t = {
    es: {
      points: "Puntos Flow",
      pointsAvailable: "Puntos Disponibles",
      pointsRequired: "Puntos Requeridos",
      pointsRemaining: "Puntos Restantes",
      history: "Mi Historial",
      claims: "Mis Reclamos",
      activeClaims: "Reclamos Activos",
      rewardsCatalog: "Catálogo de Canjes",
      canjes: "Mis Canjes",
      claimsForm: "Soporte y Reclamos",
      enterRut: "Ingresar RUT o Email",
      enterPassword: "Ingresa tu Contraseña",
      login: "Iniciar Sesión",
      logout: "Cerrar Sesión Móvil",
      resolved: "Resuelto",
      pending: "Pendiente",
      approved: "Aprobado",
      rejected: "Rechazado",
      insufficientPoints: "Puntos Insuficientes",
      pointsDeducted: "Puntos canjeados con éxito",
      claimSuccess: "Reclamo enviado correctamente",
      newClaim: "Radicar Nuevo Reclamo",
      rut: "RUT Cliente",
      orderId: "Número de Boleta",
      reason: "Motivo del Reclamo",
      description: "Detalle o Descripción",
      submitClaim: "Radicar Reclamo",
      available: "Disponibles",
      myVouchers: "Mis Cupones",
      challenges: "Desafíos",
      shop: "Tienda Online",
      home: "Inicio",
      offers: "Mis Ofertas",
      wallet: "Mi Billetera",
      settings: "Configuración",
      delivery: "Seguimiento Despacho",
      claimDetails: "Detalles del Reclamo",
      claimStatus: "Estado del Reclamo",
      claimResolvedMessage: "Tu reclamo ha sido resuelto por soporte.",
      // Access / Authentication screens
      accountBenefits: "Accede a tus beneficios.",
      createAccountSeconds: "Crea tu cuenta en segundos.",
      recoverAccess: "Recupera el acceso a tu cuenta.",
      activateLegacyAccount: "Activa tu cuenta de cliente existente.",
      emailLabel: "Correo Electrónico",
      passwordLabel: "Contraseña",
      passwordMin: "Contraseña (mínimo 6)",
      fullNameLabel: "Tu nombre",
      fullNamePlaceholder: "Nombre completo",
      activateNotice: "Si ya compraste en nuestra tienda y el cajero registró tus datos con tu RUT, ingrésalo aquí y te enviaremos un correo para crear tu contraseña.",
      sendActivationEmail: "Enviar correo de activación",
      alreadyHaveAccount: "Ya tengo cuenta — Iniciar sesión",
      notRegisteredYet: "¿No tienes cuenta? Regístrate",
      forgotPasswordQuestion: "¿Olvidaste tu contraseña?",
      boughtInStoreActivate: "¿Compraste en nuestra tienda? Activar mi cuenta",
      enterEmailReset: "Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.",
      sendRecoverEmail: "Enviar correo",
      backToLogin: "Volver al inicio de sesión",
      emailRequiredError: "Ingresa tu email para enviarte el correo de restablecimiento.",
      rutRequiredError: "Ingresa tu RUT para activar tu cuenta.",
      invalidEmailError: "Por favor ingresa un correo electrónico válido.",
      // Home Screen / Point Widgets
      accumulatedPoints: "Puntos Acumulados",
      pointsProgress: "Progreso al siguiente nivel",
      pushNotifications: "Notificaciones Push",
      pushSubscribed: "Suscripción Activa v2.0",
      pushUnsubscribed: "Recibe avisos de despacho en vivo",
      pushActiveNotice: "Notificaremos inmediatamente los cambios de tu pedido.",
      pushInactiveNotice: "Se te avisará al preparar y despachar.",
      connecting: "Conectando…",
      active: "Activo",
      redeem: "Canjear",
      buy: "Comprar",
      offersForYou: "Ofertas para ti",
      viewAll: "Ver Todas",
      welcomeUser: (name: string) => `¡Hola, ${name}!`,
      pointsLower: "pts",
      brandVersionText: "CLIENTES",
      // Coupons & Vouchers Alerts/Metadata
      loyaltyCouponActive: "¡Cupón Fidelidad por Puntos Activo!",
      businessCouponActive: "¡Cupón de la Empresa Activo!",
      loyaltyCouponMessage: (code: string, desc: string) => `Presenta el código "${code}" en la caja del local para aplicar un ${desc}.`,
      businessCouponMessage: (code: string, desc: string) => `Presenta el código "${code}" en caja para aplicar: ${desc}.`,
      registeredInSystem: "REGISTRADO EN SISTEMA",
      pointsMissingForCoupon: (pts: number, desc: string) => `Faltan ${pts} pts para este cupón (${desc})`,
      // Wallet Screen
      digitalCardTitle: "Tu Tarjeta Digital",
      digitalCardNotice: "Presenta este código seguro en caja para identificarte y usar tus cupones sin dictar tu RUT.",
      secureDynamicCode: "CÓDIGO DINÁMICO SEGURO",
      updateInSeconds: (sec: number) => `Se actualiza en ${sec}s`,
      numericOtpToken: "Token Numérico de Entrada",
      manualEntryNotice: "Ingreso manual en caja si el lector óptico está apagado",
      prepaidDigitalWallet: "Billetera Prepago Digital",
      chargeSuccessTitle: "Carga Exitosa",
      chargeSuccessMessage: "Se han cargado $10.000 CLP de forma simulada vía Flow. ¡Tu saldo se actualizó al instante!",
      chargeSuccessMessage50: "Se han cargado $50.000 CLP de forma simulada vía Flow. ¡Tu saldo se actualizó al instante!",
      simulationNotice: "Recarga instantánea simulada para validar la unificación del saldo electrónico con el punto de venta (POS) en tiempo real.",
      screenshotProtected: "Protegido contra capturas de pantalla y suplantación",
      closeCard: "Cerrar Tarjeta",
      // Sidebar Drawer Screen
      myAccount: "Mi Cuenta",
      configAndSupport: "Configuración y Soporte",
      uploadProfilePhoto: "Subir foto de perfil",
      profileVerified: "Perfil Verificado",
      memberTier: (tier: string) => `Socio ${tier}`,
      idVerifiedBadge: "ID Verificado",
      uploadPhotoToVerify: "Sube una foto para verificar tu ID",
      registeredRut: "RUT Registrado",
      linkedPhone: "Teléfono de Enlace",
      editContactData: "Editar Datos de Contacto",
      emailInvoices: "Correo Electrónico (Boletas/Flow)",
      billingType: "Tipo de Facturación",
      retailPerson: "Persona Natural (Minorista)",
      wholesaleCompany: "Empresa (Mayorista)",
      profileSavedTitle: "¡Perfil Guardado! 🎉",
      profileSavedMessage: "Tus datos de contacto se actualizaron exitosamente.",
      saveErrorTitle: "Error al guardar",
      saveErrorMessage: "Ocurrió un error al actualizar los datos en la base de datos.",
      saveChanges: "Guardar Cambios",
      accountAccessHeader: "Accesos Cuenta",
      rewardsRedemptionMenu: "Canje de Premios",
      activeCouponsMenu: "Mis Cupones Activos",
      closeSessionMobile: "Cerrar Sesión Móvil",
      noRegistered: "No registrado",
      viewReceipts: "Ver Mis Boletas",
      accountSecurity: "Seguridad de la Cuenta",
      // E-commerce Online Shop Tab
      itemsCount: (count: number, label: string) => `${count} ${label}`,
      itemsPlural: "Artículos",
      itemsSingular: "Artículo",
      searchPlaceholder: "Buscar marca, SKU o nombre…",
      viewGrid: "Vista de Cuadrícula",
      viewList: "Lista de Pedido Rápido",
      allCategory: "Todo",
      showingCountOf: (show: number, total: number) => `Viendo ${show} de ${total} productos`,
      sortByLabel: "Ordenar:",
      sortName: "Alfabético",
      sortPriceAsc: "Precio: Menor a Mayor",
      sortPriceDesc: "Precio: Mayor a Menor",
      sortDiscount: "Mejor Oferta/Mayorista",
      noMatchesTitle: "Sin coincidencias",
      noMatchesDesc: "Prueba ajustando la búsqueda o seleccionando otra de tus categorías.",
      resetFilters: "Restablecer Filtros",
      lowStockBadge: (stock: number) => `Poco Stock (${stock})`,
      wholesalePricingBadge: "Precio Mayorista",
      wholesaleMinUnit: (price: string, qty: number) => `${price} bulto (${qty}+)`,
      stockLimitTitle: "Límite de Stock",
      stockLimitMessage: (stock: number) => `Únicamente hay ${stock} unidades de este producto en inventario.`,
      addBtn: "Añadir",
      loadMoreBtn: "Cargar más artículos",
      processingBtn: "PROCESANDO…",
      reviewOrderBtn: "REVISAR PEDIDO",
      // Shopping Cart Modal
      orderCartTitle: "Tu Pedido",
      cartEmptyText: "Tu carrito está vacío",
      hasCouponLabel: "¿Tienes un cupón?",
      removeLabel: "Quitar",
      couponPlaceholder: "CÓDIGO (ej. SUMMER15)",
      applyLabel: "Aplicar",
      subtotalLabel: "Subtotal",
      discountLabel: "Descuento",
      estimatedTotalLabel: "Total Estimado",
      confirmOrderTitle: "Confirmar Pedido",
      confirmOrderMsg: (total: string) => `Estás a punto de procesar tu compra por ${total}. Serás redirigido a Flow para realizar el pago de forma segura.`,
      finishCheckoutBtn: "Finalizar Compra",
      // Notifications Modal
      notificationsTitle: "Notificaciones",
      notificationsEmpty: "No tienes notificaciones por ahora",
      closeBtn: "Cerrar",
      // Receipt Details Modal
      receiptTitle: "Comprobante de Compra",
      docLabel: "Documento",
      orderCodeLabel: "Código de Orden",
      dateTimeLabel: "Fecha & Hora",
      attendedByLabel: "Atendido por",
      attendedAutoApp: "Auto-Atención App",
      attendedCashier: (name: string) => `Cajero: ${name}`,
      attendedCashierDefault: "Cajero de Turno",
      purchaseTypeLabel: "Tipo de Compra",
      purchaseTypeApp: "Pedido Online (App)",
      purchaseTypePos: "Compra Presencial (POS)",
      deliveryMethodLabel: "Método de Entrega",
      deliveryMethodApp: "Retiro en Local 🏬",
      deliveryMethodPos: "Entrega Presencial 🤝",
      productDetailHeader: "Detalle de Productos",
      qtyUnitsTimes: (qty: number, plural: string, price: string) => `${qty} unidad${plural} x ${price}`,
      pluralSuffix: "s",
      singularSuffix: "",
      shippedFromBranch: (name: string) => `Despachado desde ${name}`,
      receiptSubtotal: "Subtotal de Compra:",
      receiptTotalPaid: "Total Pagado:",
      fidelityPointsReward: "Puntos de Fidelidad",
      fidelityPointsMessage: "Acumulados con este recibo",
      deliveryProofTitle: "📦 Comprobante de Entrega Digital",
      receivedByLabel: "Recibido por:",
      deliveredBadge: "Entregado ✓",
      digitalSignatureTitle: "Firma digital registrada:",
      digitalSignatureAlt: "Firma del Cliente",
      internalReceiptWarning: "COMPROBANTE INTERNO DE COMPRA — NO VÁLIDO COMO BOLETA ELECTRÓNICA",
      siiStampHeader: "TIMBRE ELECTRÓNICO SII",
      siiStampDesc: (folio: string) => `DTE Boleta Electrónica - Folio ${folio}`,
      siiPendingWarning: "SOLICITE EL COMPROBANTE SII TRAS LA SINCRONIZACIÓN EN LÍNEA",
      verificationCodeLabel: "Código de Verificación",
      printBtn: "Imprimir",
      loading: "Cargando...",
      loadingProfile: "Cargando perfil...",
      slogan: "Donde cada venta construye confianza.",
      levelLabel: "Nivel",
      closeNotification: "Cerrar notificación",
      claimResolvedTitle: "Reclamo Resuelto",
      claimResolvedMsg: (id: string) => `Tu caso para el Pedido #${id} fue resuelto con éxito`,
      fulfillmentResponse: "Respuesta de Bodega",
      understood: "Entendido",
      activeStatus: "Activo",
      activateBtn: "Activar",
      pointsNoticeCart: "¡Suma puntos con tus compras para activar cupones automáticos! 🛒",
      startNav: "Inicio",
      receiptsNav: "Boletas",
      couponsNav: "Cupones",
      deliveryNav: "Envíos",
      myReceipts: "Mis Boletas",
      satisfactionGuarantee: "Garantía de Satisfacción",
      satisfactionGuaranteeDesc: "¿Un producto llegó dañado o faltó en tu envío? No te preocupes. Selecciona una boleta en \"Mis Boletas\" e inicia tu reclamo con foto de evidencia para reembolso inmediato.",
      resolvedStatus: "Resuelto / Solucionado",
      rejectedStatus: "Cerrado - Rechazado",
      pendingStatus: "Pendiente de Revisión",
      purchaseClaimLabel: "Reclamo de Compra",
      orderLabel: "Orden",
      attachedEvidenceLabel: "Evidencia Adjunta",
      claimEvidenceTitle: "Evidencia de Reclamo",
      claimEvidenceDesc: "Fotografía cargada por el cliente como evidencia física del problema.",
      noClaimsLogged: "No has ingresado ningún reclamo",
      rewardsTitle: "Canje de Premios Físicos",
      rewardsSubtitle: "Fidelidad y Regalos Directos",
      pointsEquivTitle: "Equivalencia aproximada",
      pointsEquivDesc: "10 PTS = $100 CLP en productos",
      redeemRewardBtn: "Canjear Regalo",
      pointsMissingReward: (pts: number) => `Faltan ${pts} pts`,
      noRedemptions: "Aún no tienes canjes acumulados",
      viewRewardsCatalog: "Ver Catálogo de Premios",
      pendingPickup: "Por Retirar",
      delivered: "Entregado",
      redeemedOn: (date: string) => `Canjeado el ${date}`,
      redemptionPickupNotice: "Presenta este código QR o tu RUT en caja para retirar tu producto físico inmediatamente.",
      redemptionDeliveredNotice: "Este producto ya te fue entregado por un vendedor en la tienda de forma exitosa.",
      confirmRewardTitle: "Confirmar Canje de Regalo",
      cancelBtn: "Cancelar",
      confirmRedeemBtn: "Confirmar Canje",
      challengesTitle: "Academia de Desafíos Semanales",
      challengesSubtitle: "¡Completa misiones y suma puntos!",
      chCompradorEstrella: "Comprador Estrella ⭐",
      chCompradorEstrellaDesc: "Acumula un mínimo de $50.000 CLP en compras totales en el local.",
      chEcoBoleta: "Eco-Comprador Boleta Digital 🌱",
      chEcoBoletaDesc: "Mantén un correo registrado para recibir tus boletas y facturas 100% digitales.",
      chMayoristaPro: "Inversionista Mayorista 📦",
      chMayoristaProDesc: "Suma un acumulado histórico de 1.000 Puntos de Fidelidad.",
      chSocioPionero: "Socio Pionero Dorado 🏆",
      chSocioPioneroDesc: "Registra al menos 3 transacciones o boletas en el historial.",
      completed: "Completado",
      progressLabel: "Progreso",
      challengeClaimedSuccess: "✓ Desafío Reclamado con Éxito",
      claimExtraRewardBtn: "Reclamar Premio Extra",
      locked: "Bloqueado",
      challengeClaimedAlertTitle: "✨ ¡Desafío Reclamado! ✨",
      challengeClaimedAlertMessage: (title: string, points: number) => `Felicidades, has desbloqueado "${title}" y ganado un bono de +${points} Puntos extra para canjear regalos.`,
      generalClaimTitle: "Reclamo General Chile",
      reasonBroken: "Llegó roto / dañado",
      reasonMissing: "Faltó un producto en el envío",
      reasonWrong: "Recibí un producto equivocado",
      reasonDefect: "Defecto de calidad/fábrica",
      reasonOther: "Otro inconveniente",
      claimPlaceholder: "Explica detalladamente qué sucedió con tu producto o pedido…",
      characters: "caracteres",
      evidenceLabel: "Foto de Evidencia (Físico/Empaque)",
      camera: "CÁMARA",
      cameraInstruction: "Toma una fotografía clara del producto roto, vencido o del empaque completo.",
      claimRegisteredTitle: "¡Reclamo Registrado!",
      claimRegisteredMessage: "Tu caso fue subido con éxito y enviado a bodega. Estaremos evaluando tu caso de inmediato.",
      claimErrorTitle: "Error de Envío",
      claimErrorMessage: "No se pudo registrar el reclamo. Verifica tu conexión a internet e intenta nuevamente.",
      submitCaseBtn: "Enviar Caso",
      xWholesale: "xMayor"
    },
    en: {
      points: "Flow Points",
      pointsAvailable: "Available Points",
      pointsRequired: "Points Required",
      pointsRemaining: "Remaining Points",
      history: "My History",
      claims: "My Claims",
      activeClaims: "Active Claims",
      rewardsCatalog: "Redemption Catalog",
      canjes: "My Redemptions",
      claimsForm: "Support & Claims",
      enterRut: "Enter RUT or Email",
      enterPassword: "Enter your Password",
      login: "Log In",
      logout: "Log Out",
      resolved: "Resolved",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      insufficientPoints: "Insufficient Points",
      pointsDeducted: "Points successfully redeemed",
      claimSuccess: "Claim submitted successfully",
      newClaim: "File New Claim",
      rut: "Customer RUT",
      orderId: "Receipt Number",
      reason: "Claim Reason",
      description: "Description / Details",
      submitClaim: "Submit Claim",
      available: "Available",
      myVouchers: "My Vouchers",
      challenges: "Challenges",
      shop: "Online Shop",
      home: "Home",
      offers: "My Offers",
      wallet: "My Wallet",
      settings: "Settings",
      delivery: "Delivery Tracker",
      claimDetails: "Claim Details",
      claimStatus: "Claim Status",
      claimResolvedMessage: "Your claim has been resolved by our support team.",
      // Access / Authentication screens
      accountBenefits: "Access your benefits.",
      createAccountSeconds: "Create your account in seconds.",
      recoverAccess: "Recover access to your account.",
      activateLegacyAccount: "Activate your existing customer account.",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      passwordMin: "Password (minimum 6)",
      fullNameLabel: "Your name",
      fullNamePlaceholder: "Full name",
      activateNotice: "If you already bought in our store and the cashier registered your details with your RUT, enter it here and we will send you an email to create your password.",
      sendActivationEmail: "Send activation email",
      alreadyHaveAccount: "Already have an account — Log In",
      notRegisteredYet: "Don't have an account? Sign Up",
      forgotPasswordQuestion: "Forgot your password?",
      boughtInStoreActivate: "Bought in our store? Activate my account",
      enterEmailReset: "Enter your email and we will send you a link to reset your password.",
      sendRecoverEmail: "Send email",
      backToLogin: "Back to Login",
      emailRequiredError: "Enter your email to send the reset link.",
      rutRequiredError: "Enter your RUT to activate your account.",
      invalidEmailError: "Please enter a valid email address.",
      // Home Screen / Point Widgets
      accumulatedPoints: "Accumulated Points",
      pointsProgress: "Progress to next level",
      pushNotifications: "Push Notifications",
      pushSubscribed: "Subscription Active v2.0",
      pushUnsubscribed: "Receive live delivery alerts",
      pushActiveNotice: "We will notify you immediately of changes to your order.",
      pushInactiveNotice: "You will be notified upon preparation and dispatch.",
      connecting: "Connecting…",
      active: "Active",
      redeem: "Redeem",
      buy: "Shop",
      offersForYou: "Offers for you",
      viewAll: "View All",
      welcomeUser: (name: string) => `Hello, ${name}!`,
      pointsLower: "pts",
      brandVersionText: "CLIENTS",
      // Coupons & Vouchers Alerts/Metadata
      loyaltyCouponActive: "Loyalty Coupon Points Active!",
      businessCouponActive: "Company Coupon Active!",
      loyaltyCouponMessage: (code: string, desc: string) => `Present code "${code}" at checkout to apply ${desc}.`,
      businessCouponMessage: (code: string, desc: string) => `Present code "${code}" at checkout to apply: ${desc}.`,
      registeredInSystem: "REGISTERED IN SYSTEM",
      pointsMissingForCoupon: (pts: number, desc: string) => `${pts} pts left for this coupon (${desc})`,
      // Wallet Screen
      digitalCardTitle: "Your Digital Card",
      digitalCardNotice: "Present this secure code at checkout to identify yourself and use your coupons without dictating your RUT.",
      secureDynamicCode: "SECURE DYNAMIC CODE",
      updateInSeconds: (sec: number) => `Updates in ${sec}s`,
      numericOtpToken: "Numeric Entry Token",
      manualEntryNotice: "Manual entry at register if the optical reader is turned off",
      prepaidDigitalWallet: "Prepaid Digital Wallet",
      chargeSuccessTitle: "Top-up Successful",
      chargeSuccessMessage: "Simulated $10,000 CLP has been loaded via Flow. Your balance updated instantly!",
      chargeSuccessMessage50: "Simulated $50,000 CLP has been loaded via Flow. Your balance updated instantly!",
      simulationNotice: "Simulated instant reload to validate integration of electronic balance with checkout (POS) in real time.",
      screenshotProtected: "Protected against screenshots and spoofing",
      closeCard: "Close Card",
      // Sidebar Drawer Screen
      myAccount: "My Account",
      configAndSupport: "Settings & Support",
      uploadProfilePhoto: "Upload profile photo",
      profileVerified: "Profile Verified",
      memberTier: (tier: string) => `${tier} Member`,
      idVerifiedBadge: "ID Verified",
      uploadPhotoToVerify: "Upload a photo to verify your ID",
      registeredRut: "Registered RUT",
      linkedPhone: "Link Phone",
      editContactData: "Edit Contact Details",
      emailInvoices: "Email Address (Receipts/Flow)",
      billingType: "Billing Type",
      retailPerson: "Natural Person (Retail)",
      wholesaleCompany: "Company (Wholesale)",
      profileSavedTitle: "Profile Saved! 🎉",
      profileSavedMessage: "Your contact details have been successfully updated.",
      saveErrorTitle: "Error saving",
      saveErrorMessage: "An error occurred while updating the data in the database.",
      saveChanges: "Save Changes",
      accountAccessHeader: "Account Access",
      rewardsRedemptionMenu: "Rewards Redemption",
      activeCouponsMenu: "My Active Coupons",
      closeSessionMobile: "Log Out Mobile",
      noRegistered: "Not registered",
      viewReceipts: "View My Receipts",
      accountSecurity: "Account Security",
      // E-commerce Online Shop Tab
      itemsCount: (count: number, label: string) => `${count} ${label}`,
      itemsPlural: "Items",
      itemsSingular: "Item",
      searchPlaceholder: "Search brand, SKU or name…",
      viewGrid: "Grid View",
      viewList: "Quick Order List",
      allCategory: "All",
      showingCountOf: (show: number, total: number) => `Showing ${show} of ${total} products`,
      sortByLabel: "Sort by:",
      sortName: "Alphabetical",
      sortPriceAsc: "Price: Low to High",
      sortPriceDesc: "Price: High to Low",
      sortDiscount: "Best Offer/Wholesale",
      noMatchesTitle: "No matches found",
      noMatchesDesc: "Try adjusting your search or selecting another category.",
      resetFilters: "Reset Filters",
      lowStockBadge: (stock: number) => `Low Stock (${stock})`,
      wholesalePricingBadge: "Wholesale Price",
      wholesaleMinUnit: (price: string, qty: number) => `${price} bulk (${qty}+)`,
      stockLimitTitle: "Stock Limit",
      stockLimitMessage: (stock: number) => `Only ${stock} units of this product are in stock.`,
      addBtn: "Add",
      loadMoreBtn: "Load more items",
      processingBtn: "PROCESSING…",
      reviewOrderBtn: "REVIEW ORDER",
      // Shopping Cart Modal
      orderCartTitle: "Your Order",
      cartEmptyText: "Your cart is empty",
      hasCouponLabel: "Have a coupon?",
      removeLabel: "Remove",
      couponPlaceholder: "CODE (e.g. SUMMER15)",
      applyLabel: "Apply",
      subtotalLabel: "Subtotal",
      discountLabel: "Discount",
      estimatedTotalLabel: "Estimated Total",
      confirmOrderTitle: "Confirm Order",
      confirmOrderMsg: (total: string) => `You are about to process your purchase for ${total}. You will be redirected to Flow to make the payment securely.`,
      finishCheckoutBtn: "Checkout",
      // Notifications Modal
      notificationsTitle: "Notifications",
      notificationsEmpty: "You don't have notifications right now",
      closeBtn: "Close",
      // Receipt Details Modal
      receiptTitle: "Purchase Receipt",
      docLabel: "Document",
      orderCodeLabel: "Order Code",
      dateTimeLabel: "Date & Time",
      attendedByLabel: "Attended by",
      attendedAutoApp: "App Self-Service",
      attendedCashier: (name: string) => `Cashier: ${name}`,
      attendedCashierDefault: "Cashier on Duty",
      purchaseTypeLabel: "Purchase Type",
      purchaseTypeApp: "Online Order (App)",
      purchaseTypePos: "In-Store Purchase (POS)",
      deliveryMethodLabel: "Delivery Method",
      deliveryMethodApp: "In-Store Pickup 🏬",
      deliveryMethodPos: "Hand Delivery 🤝",
      productDetailHeader: "Product Details",
      qtyUnitsTimes: (qty: number, plural: string, price: string) => `${qty} unit${plural} x ${price}`,
      pluralSuffix: "s",
      singularSuffix: "",
      shippedFromBranch: (name: string) => `Shipped from ${name}`,
      receiptSubtotal: "Purchase Subtotal:",
      receiptTotalPaid: "Total Paid:",
      fidelityPointsReward: "Fidelity Points",
      fidelityPointsMessage: "Earned with this receipt",
      deliveryProofTitle: "📦 Digital Delivery Proof",
      receivedByLabel: "Received by:",
      deliveredBadge: "Delivered ✓",
      digitalSignatureTitle: "Registered digital signature:",
      digitalSignatureAlt: "Customer Signature",
      internalReceiptWarning: "INTERNAL PURCHASE PROOF — NOT VALID AS OFFICIAL ELECTRONIC RECEIPT",
      siiStampHeader: "SII ELECTRONIC STAMP",
      siiStampDesc: (folio: string) => `SII Electronic Receipt - Folio ${folio}`,
      siiPendingWarning: "REQUEST SII PROOF AFTER ONLINE SYNCHRONIZATION",
      verificationCodeLabel: "Verification Code",
      printBtn: "Print",
      loading: "Loading...",
      loadingProfile: "Loading profile...",
      slogan: "Where every sale builds trust.",
      levelLabel: "Level",
      closeNotification: "Close notification",
      claimResolvedTitle: "Claim Resolved",
      claimResolvedMsg: (id: string) => `Your ticket for Order #${id} was successfully resolved`,
      fulfillmentResponse: "Fulfillment Response",
      understood: "Understood",
      activeStatus: "Active",
      activateBtn: "Activate",
      pointsNoticeCart: "Earn points with your purchases to activate automatic coupons! 🛒",
      startNav: "Home",
      receiptsNav: "Receipts",
      couponsNav: "Coupons",
      deliveryNav: "Delivery",
      myReceipts: "My Receipts",
      satisfactionGuarantee: "Satisfaction Guarantee",
      satisfactionGuaranteeDesc: "Did a product arrive damaged or was it missing from your shipment? Don't worry. Select any receipt in \"My Receipts\" and file a claim with photos for immediate replacement.",
      resolvedStatus: "Resolved / Closed",
      rejectedStatus: "Closed - Rejected",
      pendingStatus: "Pending Review",
      purchaseClaimLabel: "Purchase Claim",
      orderLabel: "Order",
      attachedEvidenceLabel: "Attached Evidence",
      claimEvidenceTitle: "Claim Evidence",
      claimEvidenceDesc: "Photograph uploaded by the customer as physical evidence of the issue.",
      noClaimsLogged: "You have not logged any claims",
      rewardsTitle: "Physical Rewards Redemption",
      rewardsSubtitle: "Loyalty & Direct Gifts",
      pointsEquivTitle: "Approximate equivalence",
      pointsEquivDesc: "10 PTS = $100 CLP in products",
      redeemRewardBtn: "Redeem Gift",
      pointsMissingReward: (pts: number) => `Missing ${pts} pts`,
      noRedemptions: "You don't have redemptions yet",
      viewRewardsCatalog: "View Rewards Catalog",
      pendingPickup: "Pending Pickup",
      delivered: "Delivered",
      redeemedOn: (date: string) => `Redeemed on ${date}`,
      redemptionPickupNotice: "Present this QR code or your RUT at checkout to retrieve your physical product immediately.",
      redemptionDeliveredNotice: "This product has already been successfully delivered to you by a cashier in the store.",
      confirmRewardTitle: "Confirm Gift Redemption",
      cancelBtn: "Cancel",
      confirmRedeemBtn: "Confirm Redemption",
      challengesTitle: "Weekly Challenges Academy",
      challengesSubtitle: "Complete missions and earn points!",
      chCompradorEstrella: "Star Shopper ⭐",
      chCompradorEstrellaDesc: "Accumulate a minimum of $50,000 CLP in total purchases at the store.",
      chEcoBoleta: "Eco-Shopper Digital Receipt 🌱",
      chEcoBoletaDesc: "Keep a registered email to receive your receipts and invoices 100% digitally.",
      chMayoristaPro: "Wholesale Investor 📦",
      chMayoristaProDesc: "Accumulate a lifetime total of 1,000 Loyalty Points.",
      chSocioPionero: "Golden Pioneer Member 🏆",
      chSocioPioneroDesc: "Register at least 3 transactions or receipts in your history.",
      completed: "Completed",
      progressLabel: "Progress",
      challengeClaimedSuccess: "✓ Challenge Successfully Claimed",
      claimExtraRewardBtn: "Claim Extra Reward",
      locked: "Locked",
      challengeClaimedAlertTitle: "✨ Challenge Claimed! ✨",
      challengeClaimedAlertMessage: (title: string, points: number) => `Congratulations, you have unlocked "${title}" and earned a bonus of +${points} extra Points to redeem gifts.`,
      generalClaimTitle: "General Claim Chile",
      reasonBroken: "Arrived broken / damaged",
      reasonMissing: "Missing item in delivery",
      reasonWrong: "Received wrong item",
      reasonDefect: "Quality/Factory defect",
      reasonOther: "Other issue",
      claimPlaceholder: "Please describe in detail what happened to your product or order…",
      characters: "characters",
      evidenceLabel: "Evidence Photo (Physical/Package)",
      camera: "CAMERA",
      cameraInstruction: "Take a clear picture of the damaged, expired product or of the entire package.",
      claimRegisteredTitle: "Claim Registered!",
      claimRegisteredMessage: "Your claim was successfully uploaded and sent to the warehouse. We will evaluate your case immediately.",
      claimErrorTitle: "Submission Error",
      claimErrorMessage: "Could not submit your claim. Please check your internet connection and try again.",
      submitCaseBtn: "Submit Case",
      xWholesale: "Wholesale"
    }
  };

  // Tier 5.A4.2: customer auth migrated from localStorage+plaintext to Firebase Auth.
  // `authUser` is the Firebase Auth user (driver of identity); `customer` is the
  // /customers/{uid} profile doc (loyalty data, contact info, etc.) loaded via
  // an onSnapshot listener below.
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Tier 5.C.6: customer state has 3 distinct phases:
  //   undefined → /customers snapshot not received yet (post-auth, pre-snapshot)
  //   null      → snapshot arrived and doc does NOT exist (staff/no-profile guard)
  //   object    → profile loaded, render portal
  // Initializing to `null` (as before) collapses "loading" and "no-profile",
  // causing a brief flash of the Login screen on app cold-start while the
  // snapshot is in flight.
  const [customer, setCustomer] = useState<any>(undefined);

  // Form state for the login/register/recover/activate screens.
  // - login: returning customer enters email + password.
  // - register: brand-new e-commerce customer creates account from scratch.
  // - recover: forgotten password — sends Firebase reset email.
  // - activate: legacy customer (bought in physical store, RUT captured by cashier)
  //   claims their existing /customers profile for the first time online.
  const [mode, setMode] = useState<"login" | "register" | "recover" | "activate">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<string>("");

  // Multi-branch (Tier 1.4b): /branches snapshot for customer-side order routing.
  // Customers can see all active branches' metadata (catalog is global within the retailer).
  const [activeBranches, setActiveBranches] = useState<Branch[]>([]);

  const [fcmRegistered, setFcmRegistered] = useState(false);
  const [fcmLoading, setFcmLoading] = useState(false);
  const [fcmToast, setFcmToast] = useState<{ title: string; body: string } | null>(null);

  // Load push status and initialize foreground messaging
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setFcmRegistered(true);
      }
    }

    if (customer?.id) {
      const unsub = listenToForegroundMessages((payload) => {
        setFcmToast({
          title: payload.notification?.title || "Notificación de Pedido",
          body: payload.notification?.body || "Tu despacho se actualizó."
        });
      });
      return () => {
        if (unsub) unsub();
      };
    }
  }, [customer?.id]);

  useEffect(() => {
    if (fcmToast) {
      const timer = setTimeout(() => setFcmToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [fcmToast]);

  const handleActivateNotifications = async () => {
    if (!customer?.id) return;
    setFcmLoading(true);
    try {
      const token = await requestFCMToken(customer.id, "customer");
      if (token) {
        setFcmRegistered(true);
        setFcmToast({
          title: "¡Notificaciones Activadas! 🔔",
          body: "Recibirás actualizaciones de tus pedidos en tiempo real."
        });
      } else {
        setFcmRegistered(true);
        setFcmToast({
          title: "Registro de Canales OK 🔔",
          body: "Configuración registrada en la base de datos."
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFcmLoading(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{id: string, name: string, price: number, quantity: number, image?: string}[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "history" | "offers" | "profile" | "wallet" | "shop" | "payment" | "delivery" | "rewards">("home");
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [isQRSheetOpen, setIsQRSheetOpen] = useState(false);
  const [activatedOffers, setActivatedOffers] = useState<string[]>([]);
  const [hasUnread, setHasUnread] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [selectedReceiptShipment, setSelectedReceiptShipment] = useState<any>(null);

  useEffect(() => {
    if (!selectedReceipt?.orderId) {
      setSelectedReceiptShipment(null);
      return;
    }
    const q = query(
      collection(db, "shipments"),
      where("orderId", "==", selectedReceipt.orderId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setSelectedReceiptShipment(snapshot.docs[0].data());
      } else {
        setSelectedReceiptShipment(null);
      }
    }, (err) => {
      console.error("Error loading shipment for receipt", err);
    });
    return () => unsub();
  }, [selectedReceipt]);

  // Multi-branch (Tier 1.4b): load active branches once for order routing + display.
  useEffect(() => {
    const q = query(collection(db, "branches"), where("active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
        setActiveBranches(list);
      },
      (err) => console.warn("[CustomerPortal] branches listener:", err.message)
    );
    return unsub;
  }, []);

  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [secureToken, setSecureToken] = useState("");
  const [securePin, setSecurePin] = useState("000000");
  const [timeLeft, setTimeLeft] = useState(30);
  // Tier 5.A4.2: removed legacy `availableCustomers` + `showDiagnostics` —
  // the diagnostics panel that listed all customers from an unauthenticated
  // portal was both a PII leak and a violation of the new rules
  // (allow list: if isStaff()).

  // States for Claims Support (Paso 3.1)
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [dismissedClaims, setDismissedClaims] = useState<string[]>(() => getStorageJSON<string[]>(STORAGE_KEYS.dismissedClaims, []));

  const dismissClaim = (claimId: string) => {
    const updated = [...dismissedClaims, claimId];
    setDismissedClaims(updated);
    setStorageJSON(STORAGE_KEYS.dismissedClaims, updated);
  };

  const [activeHistorySubTab, setActiveHistorySubTab] = useState<"receipts" | "claims">("receipts");
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimOrderId, setClaimOrderId] = useState("");
  const [claimCustomerTaxId, setClaimCustomerTaxId] = useState("");
  const [taxIdError, setTaxIdError] = useState("");
  const [claimReason, setClaimReason] = useState("Llegó roto");
  const [claimDescription, setClaimDescription] = useState("");
  const [claimPhoto, setClaimPhoto] = useState("");
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  
  // States for Point Rewards (Physical Products Catalogue)
  const [rewardViewTab, setRewardViewTab] = useState<"available" | "vouchers" | "desafios">("available");
  const [confirmReward, setConfirmReward] = useState<PhysicalReward | null>(null);
  const [rewardCategory, setRewardCategory] = useState<string>("Todos");

  const validateChileanRUT = (rut: string): boolean => {
    if (!rut) return false;
    const clean = rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
    if (clean.length < 2) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    if (!/^\d+$/.test(body)) return false;
    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const dvr = 11 - (sum % 11);
    const expectedDv = dvr === 11 ? "0" : dvr === 10 ? "K" : String(dvr);
    return dv === expectedDv;
  };

  // States to handle larger catalogs (e.g., 1000+ products)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "compact">("grid");
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc" | "discount">("name");
  const [visibleCount, setVisibleCount] = useState(24);

  // Dynamic category extraction based on products
  const productCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return ["Todos", ...Array.from(cats)];
  }, [products]);

  // Decoupled, high-performance filtering and sorting for huge catalogs
  const filteredAndSortedProducts = React.useMemo(() => {
    let list = [...products].filter((p) => !p.disabled && p.stock > 0);

    // 1. Filter by category
    if (selectedCategory !== "Todos") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // 2. Filter by search text (flexible on name, category, SKU, etc)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q))
      );
    }

    // 3. Sorting logic
    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "price-asc") {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === "discount") {
      list.sort((a, b) => {
        const discA = a.wholesalePrice && a.price ? (a.price - a.wholesalePrice) / a.price : 0;
        const discB = b.wholesalePrice && b.price ? (b.price - b.wholesalePrice) / b.price : 0;
        return discB - discA;
      });
    }

    return list;
  }, [products, selectedCategory, searchTerm, sortBy]);

  // Group transactions by orderId or timestamp to show full receipts/boletas
  const groupedTransactions = React.useMemo(() => {
    const groups: { [key: string]: any } = {};

    transactions.forEach(tx => {
      let groupKey = tx.orderId;
      if (!groupKey) {
        // Fallback: group items with same timestamp and customer as a single order
        const ts = tx.timestamp?.seconds || tx.timestamp?.seconds === 0 
          ? tx.timestamp.seconds 
          : Math.floor(new Date(tx.timestamp).getTime() / 1000);
        groupKey = `ts_${ts}_${tx.customerId || 'anon'}`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          orderId: tx.orderId || tx.id,
          timestamp: tx.timestamp,
          type: tx.type || "sale",
          documentType: tx.documentType || (tx.type === "app_purchase" ? "Pedido Móvil" : "Boleta Electrónica"),
          customerName: tx.customerName || "Cliente",
          customerTaxId: tx.customerTaxId || (tx.customerId === customer?.id ? customer?.taxId : null) || null,
          couponCode: tx.couponCode || null,
          discountApplied: tx.discountApplied || 0,
          finalOrderTotal: tx.finalOrderTotal || 0,
          paymentBreakdown: tx.paymentBreakdown || null,
          note: tx.note || null,
          userName: tx.userName || "Caja Auto",
          items: []
        };
      }

      // Check for duplicate items in the same grouping
      const existingItem = groups[groupKey].items.find((item: any) => item.productId === tx.productId);
      if (existingItem) {
        existingItem.quantity += tx.quantity || 1;
        existingItem.amount += tx.amount || 0;
      } else {
        groups[groupKey].items.push({
          id: tx.id,
          productId: tx.productId,
          productName: tx.productName || "Producto",
          quantity: tx.quantity || 1,
          amount: tx.amount || 0,
          branchId: tx.branchId || null
        });
      }
    });

    return Object.values(groups).map((g: any) => {
      const totalAmount = g.items.reduce((sum: number, item: any) => sum + item.amount, 0);
      if (!g.finalOrderTotal) {
        g.finalOrderTotal = Math.max(0, totalAmount - (g.discountApplied || 0));
      }
      return g;
    }).sort((a: any, b: any) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [transactions]);

  // Seed default clients on mount to ensure test credentials always exist
  // Sync real-time active coupons from Firestore
  useEffect(() => {
    const q = query(collection(db, "coupons"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(docs.filter(c => c.active));
      setLoadingCoupons(false);
    }, (err) => {
      console.error("Firestore error loading active coupons in portal:", err);
      setLoadingCoupons(false);
    });
    return unsub;
  }, []);

  // Generate dynamic notifications
  const clientNotifications = React.useMemo(() => {
    if (!customer) return [];
    const list: any[] = [];
    const currentPoints = customer.points || 0;
    const tier = getCustomerTier(currentPoints);

    // 1. Transaction-based Notification
    if (transactions.length > 0) {
      const lastTx = transactions[0];
      const points = lastTx.pointsEarned || Math.floor((lastTx.amount || 0) / 1000);
      
      let timeStr = lang === "es" ? "Hace unos minutos" : "A few minutes ago";
      if (lastTx.timestamp) {
        try {
          const date = toDate(lastTx.timestamp);
          const diffMs = Date.now() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 0) {
            timeStr = lang === "es" ? "Reciente" : "Recent";
          } else if (diffMins < 60) {
            timeStr = diffMins <= 1 
              ? (lang === "es" ? "Hace un momento" : "Just now") 
              : (lang === "es" ? `Hace ${diffMins} minutos` : `${diffMins} minutes ago`);
          } else if (diffMins < 1440) {
            const diffHours = Math.floor(diffMins / 60);
            timeStr = lang === "es" 
              ? `Hace ${diffHours} hr${diffHours > 1 ? "s" : ""}` 
              : `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
          } else {
            timeStr = date.toLocaleDateString(lang === "es" ? "es-CL" : "en-US");
          }
        } catch (_) {}
      }

      list.push({
        id: `tx-${lastTx.id}`,
        title: lang === "es" ? "Puntos Recibidos" : "Points Received",
        message: lang === "es" 
          ? `¡Ganaste ${points} puntos en tu última compra de ${formatCurrency(lastTx.amount)}!`
          : `You earned ${points} points on your last purchase of ${formatCurrency(lastTx.amount)}!`,
        timeText: timeStr,
        accent: "text-indigo-600 bg-indigo-50 border-indigo-100",
        icon: "puntos"
      });
    } else {
      list.push({
        id: "msg-welcome-purchase",
        title: lang === "es" ? "Bienvenido" : "Welcome",
        message: lang === "es" 
          ? "¡Realiza tu primera compra desde la tienda y acumula 1 punto por cada $1.000 CLP!"
          : "Make your first purchase from the store and earn 1 point for every $1,000 CLP!",
        timeText: lang === "es" ? "Reciente" : "Recent",
        accent: "text-indigo-600 bg-indigo-50 border-indigo-100",
        icon: "puntos"
      });
    }

    // 2. Next Tier Goal Notification
    if (currentPoints < 5000) {
      let nextTierName = "";
      let pointsNeeded = 0;
      if (currentPoints < 500) {
        nextTierName = "Silver";
        pointsNeeded = 500 - currentPoints;
      } else if (currentPoints < 2000) {
        nextTierName = "Gold";
        pointsNeeded = 2000 - currentPoints;
      } else {
        nextTierName = "Platinum";
        pointsNeeded = 5000 - currentPoints;
      }
      list.push({
        id: `tier-goal-${nextTierName.toLowerCase()}`,
        title: lang === "es" ? "Meta de Nivel" : "Tier Goal",
        message: lang === "es" 
          ? `Estás a sólo ${pointsNeeded} puntos de alcanzar el nivel ${nextTierName} y desbloquear nuevos beneficios.`
          : `You are only ${pointsNeeded} points away from reaching the ${nextTierName} tier and unlocking new benefits.`,
        timeText: lang === "es" ? "Meta Activa" : "Active Goal",
        accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
        icon: "meta"
      });
    } else {
      list.push({
        id: "tier-plat-max",
        title: lang === "es" ? "¡Nivel Máximo!" : "Max Tier!",
        message: lang === "es" 
          ? `¡Felicitaciones! Has alcanzado el nivel Platinum, la categoría más exclusiva de ${settings.businessName || "StockFlow"} Pro.`
          : `Congratulations! You have reached Platinum level, the most exclusive category of ${settings.businessName || "StockFlow"} Pro.`,
        timeText: lang === "es" ? "Meta Completada" : "Goal Completed",
        accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
        icon: "meta"
      });
    }

    // 3. Dynamic Real-time Coupons & Loyalty Benefits
    const unlockedAuto = AUTOMATIC_POINT_COUPONS.filter(c => currentPoints >= c.requiredPoints);
    const eligibleReal = coupons.filter(c => currentPoints >= ((LOYALTY_TIERS as any)[c.minTier]?.min || 0));
    
    if (unlockedAuto.length > 0 || eligibleReal.length > 0) {
      const bestAuto = unlockedAuto[unlockedAuto.length - 1];
      const itemsCount = unlockedAuto.length + eligibleReal.length;
      
      list.push({
        id: "active-coupons-alert",
        title: lang === "es" ? "Beneficio Exclusivo" : "Exclusive Benefit",
        message: bestAuto 
          ? (lang === "es" 
              ? `¡Tienes ${itemsCount} beneficios listos! Tu "${bestAuto.title}" (${bestAuto.desc}) está activo con tus ${currentPoints} puntos.`
              : `You have ${itemsCount} benefits ready! Your "${bestAuto.title}" (${bestAuto.desc}) is active with your ${currentPoints} points.`)
          : (lang === "es" 
              ? `¡Tienes ${itemsCount} cupones activos de la empresa para canjear en tu próxima visita!`
              : `You have ${itemsCount} active company coupons to redeem on your next visit!`),
        timeText: lang === "es" ? "Activo" : "Active",
        accent: "text-amber-600 bg-amber-50 border-amber-100",
        icon: "oferta"
      });
    } else {
      const nextLocked = AUTOMATIC_POINT_COUPONS.find(c => currentPoints < c.requiredPoints);
      list.push({
        id: "no-coupons-yet",
        title: lang === "es" ? "Beneficio en Camino" : "Benefit on the Way",
        message: nextLocked 
          ? (lang === "es" 
              ? `Acumula ${nextLocked.requiredPoints - currentPoints} puntos más para desbloquear automáticamente tu "${nextLocked.title}" (${nextLocked.desc}).`
              : `Accumulate ${nextLocked.requiredPoints - currentPoints} more points to automatically unlock your "${nextLocked.title}" (${nextLocked.desc}).`)
          : (lang === "es" 
              ? "¡Suma puntos con tus compras en el local para activar tus primeros cupones automáticos de fidelidad!"
              : "Earn points with your purchases at the store to activate your first automatic loyalty coupons!"),
        timeText: lang === "es" ? "Próximo Canje" : "Next Redemption",
        accent: "text-amber-600 bg-amber-50 border-amber-100",
        icon: "oferta"
      });
    }

    return list;
  }, [customer, transactions, coupons, lang, settings.businessName]);

  // Handle auto-reset hasUnread when opened
  useEffect(() => {
    if (showNotifications) {
      setHasUnread(false);
    }
  }, [showNotifications]);

  // Set unread to true when transactions count updates
  useEffect(() => {
    if (transactions.length > 0) {
      setHasUnread(true);
    }
  }, [transactions.length]);

  // Rotating Dynamic QR Code security token logic
  useEffect(() => {
    if (activeTab !== "wallet" || !customer?.id) return;

    const generateNewToken = async () => {
      const expiresAt = Date.now() + 30000;
      const currentBalance = customer.balance !== undefined ? customer.balance : 25000;
      const token = `STK:ID:${customer.taxId}:${expiresAt}:${currentBalance}`;
      setSecureToken(token);
      
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      setSecurePin(randomPin);
      setTimeLeft(30);

      try {
        await updateDoc(doc(db, "customers", customer.id), {
          securePin: randomPin,
          securePinExpiresAt: expiresAt
        });
      } catch (e) {
        console.error("Error updating secure PIN in Firestore:", e);
      }
    };

    generateNewToken();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateNewToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, customer?.id, customer?.taxId]);

  // Profile Edit State
  const [profileEmail, setProfileEmail] = useState("");
  const [profileType, setProfileType] = useState<"retail" | "wholesale">("retail");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfileEmail(customer.email || "");
      setProfileType(customer.type || "retail");
    }
  }, [customer]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "customers", customer.id), {
          photoURL: base64String,
          photoVerified: true
        });
        const updated = {
          ...customer,
          photoURL: base64String,
          photoVerified: true
        };
        // Tier 5.A4.2: optimistic UI update; the /customers/{uid} onSnapshot
        // listener will reconfirm on Firestore roundtrip. No localStorage write.
        setCustomer(updated);
        setAlertConfig({
          isOpen: true,
          type: "success",
          title: lang === "es" ? "Foto de Perfil Subida" : "Profile Photo Uploaded",
          message: lang === "es" 
            ? `Tu fotografía se ha subido y tu perfil ha sido verificado con éxito por ${settings.businessName || "StockFlow"}.` 
            : `Your photo has been uploaded and your profile has been successfully verified by ${settings.businessName || "StockFlow"}.`
        });
      } catch (err) {
        console.error("Error updating profile photo icon", err);
        setError(lang === "es" ? "Error al cargar tu foto de perfil." : "Error uploading your profile photo.");
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRedeemReward = async (reward: PhysicalReward) => {
    if (!customer?.id) return;
    if ((customer.points || 0) < reward.pointsCost) {
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: lang === "es" ? "Puntos Insuficientes" : "Insufficient Points",
        message: lang === "es" 
          ? `Necesitas ${reward.pointsCost} puntos para canjear este premio. Actualmente tienes ${customer.points || 0} puntos.`
          : `You need ${reward.pointsCost} points to redeem this reward. You currently have ${customer.points || 0} points.`
      });
      return;
    }

    try {
      setLoading(true);
      const newPoints = (customer.points || 0) - reward.pointsCost;
      
      const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const validationCode = `RDM-${reward.id.replace('rew-', '').substring(0, 4).toUpperCase()}-${randHex}`;

      // 1. Create a redemption receipt doc in Firestore
      await addDoc(collection(db, "redemptions"), {
        customerId: customer.id,
        customerName: customer.name || "Cliente",
        customerRUT: customer.taxId || "Sin RUT",
        customerEmail: customer.email || "",
        productId: reward.id,
        productName: reward.name,
        pointsCost: reward.pointsCost,
        validationCode: validationCode,
        status: "pending",
        timestamp: new Date() // Fallback timestamp to keep query and sort fully local/immediate-friendly
      });

      // 2. Subtract points from the customer document
      await updateDoc(doc(db, "customers", customer.id), {
        points: newPoints
      });

      // 3. Log a special entry in transactions
      await addDoc(collection(db, "transactions"), {
        customerId: customer.id,
        customerName: customer.name || "Cliente",
        customerTaxId: customer.taxId || "Sin RUT",
        productName: `[Canje de Premio] ${reward.name}`,
        productId: reward.id,
        quantity: 1,
        amount: 0,
        pointsAwarded: -reward.pointsCost,
        type: "redemption",
        branchId: "default",
        timestamp: new Date()
      });

      setAlertConfig({
        isOpen: true,
        type: "success",
        title: lang === "es" ? "¡Canje Realizado con Éxito! 🎉" : "Redemption Successful! 🎉",
        message: lang === "es"
          ? `Has canjeado ${reward.pointsCost} puntos por "${reward.name}". Muestra tu código de canje "${validationCode}" en caja para retirar tu producto físico.`
          : `You have redeemed ${reward.pointsCost} points for "${reward.name}". Present your redemption code "${validationCode}" at checkout to retrieve your physical product.`
      });
      
      setRewardViewTab("vouchers");
    } catch (e: any) {
      console.error(e);
      setAlertConfig({
        isOpen: true,
        type: "error",
        title: lang === "es" ? "Error en el canje" : "Redemption Error",
        message: (lang === "es" ? "Ocurrió un error al procesar tu canje: " : "An error occurred while processing your redemption: ") + e.message
      });
    } finally {
      setLoading(false);
      setConfirmReward(null);
    }
  };

  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "delete" | "info";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check for payment result in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && customer) {
      verifyPayment(token);
    }
  }, [customer]);

  const verifyPayment = async (token: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/flow/payment-status?token=${token}`);
      const data = await resp.json();
      
      // Status codes: 1=Pending, 2=Paid
      if (data.status === 2) {
        await finalizeOrder();
      } else if (data.status === 1) {
        setError(lang === "es" ? "Pago en proceso…" : "Payment processing…");
      } else {
        setError(lang === "es" ? "El pago no fue completado." : "Payment was not completed.");
      }
    } catch (err) {
      setError(lang === "es" ? "Error al verificar pago." : "Error verifying payment.");
    } finally {
      setLoading(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const finalizeOrder = async () => {
    const total = cartTotal;
    const pointsToEarn = Math.floor(total / 1000);
    
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      const moq = product?.wholesaleMinQty || 6;
      const price = (item.quantity >= moq && product?.wholesalePrice) 
        ? Number(product.wholesalePrice) 
        : Number(item.price);

      await addDoc(collection(db, "transactions"), {
        customerId: customer.id,
        customerName: customer.name,
        customerTaxId: customer.taxId || null,
        productId: item.id,
        productName: item.name,
        amount: price * item.quantity,
        quantity: item.quantity,
        pointsEarned: pointsToEarn,
        timestamp: serverTimestamp(),
        type: "app_purchase",
        paymentStatus: "paid",
        branchId: "default",
        documentType: customer.type === "wholesale" ? "Factura Electrónica" : "Boleta Electrónica"
      });
    }

    await updateDoc(doc(db, "customers", customer.id), {
      points: (customer.points || 0) + pointsToEarn
    });

    setAlertConfig({
      isOpen: true,
      type: "success",
      title: lang === "es" ? "¡Pago Confirmado!" : "Payment Confirmed!",
      message: lang === "es"
        ? `Gracias por tu compra. Ganaste ${pointsToEarn} puntos. Tu pedido está siendo preparado para retiro en tienda.`
        : `Thank you for your purchase. You earned ${pointsToEarn} points. Your order is being prepared for in-store pickup.`
    });
    setCart([]);
    setActiveTab("home");
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        image: product.image 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleApplyCoupon = (codeToApply: string) => {
    setCouponError("");
    const codeUpper = codeToApply.trim().toUpperCase();
    if (!codeUpper) return;

    // Reject already used coupon by this customer
    if (customer?.usedCoupons && customer.usedCoupons.includes(codeUpper)) {
      setCouponError("Este cupón ya fue utilizado en su cuenta.");
      return;
    }

    // Check automatic point-based loyalty coupon
    const autoCoupon = AUTOMATIC_POINT_COUPONS.find(c => c.code === codeUpper);
    const currentPoints = customer?.points || 0;
    
    if (autoCoupon) {
      if (currentPoints < autoCoupon.requiredPoints) {
        setCouponError(`Se requieren ${autoCoupon.requiredPoints} pts para este cupón.`);
        return;
      }
      setAppliedCoupon(autoCoupon);
      setCouponInput("");
      return;
    }

    // Check enterprise promo coupons in state
    const dbCoupon = coupons.find(c => c.code === codeUpper);
    if (dbCoupon) {
      if (!dbCoupon.active) {
        setCouponError("Este cupón no se encuentra activo.");
        return;
      }
      const minPointsNeeded = LOYALTY_TIERS[dbCoupon.minTier]?.min || 0;
      if (currentPoints < minPointsNeeded) {
        setCouponError(`Se requiere nivel ${dbCoupon.minTier} o superior para usar este cupón.`);
        return;
      }
      setAppliedCoupon(dbCoupon);
      setCouponInput("");
      return;
    }

    setCouponError("Código de cupón inválido.");
  };

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    const moq = product?.wholesaleMinQty || 6;
    const reachedMOQ = item.quantity >= moq;
    const price = (reachedMOQ && product?.wholesalePrice) 
      ? Number(product.wholesalePrice) 
      : Number(item.price);
    return sum + (price * item.quantity);
  }, 0);

  const couponDiscount = appliedCoupon 
    ? (appliedCoupon.discountType === "percent" 
        ? Math.round(cartTotal * (appliedCoupon.discountValue / 100)) 
        : Number(appliedCoupon.discountValue)) 
    : 0;

  const finalCartTotal = Math.max(0, cartTotal - couponDiscount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customer || !customer.email) {
      setError("Falta información del cliente (email). Por favor inicia sesión nuevamente.");
      setAlertConfig(prev => ({ ...prev, isOpen: false }));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const description = `Pedido de ${customer.name}${appliedCoupon ? ` (Cupón: ${appliedCoupon.code})` : ""}`;
      const baseUrl = window.location.origin;

      // Multi-branch (Tier 1.4b): per-item branch routing.
      // Strategy:
      //   1. Sort active branches by distance to the customer's geolocation (Haversine).
      //      If the customer has no geo on their profile, branches stay in load order
      //      with "default" pinned to top.
      //   2. For each cart item, walk the sorted list and pick the FIRST branch that
      //      has stock >= item.quantity in /product_stock/{productId}_{branchId}.
      //   3. Fall back to "default" if no branch has enough stock (the order will fail
      //      at FlowResult.tsx stock check — caller already saw stock UI in catalog).
      const customerLat = Number(customer?.geolocation?.lat);
      const customerLng = Number(customer?.geolocation?.lng);
      const haveCustomerGeo = !isNaN(customerLat) && !isNaN(customerLng);

      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const sortedBranches = [...activeBranches].sort((a, b) => {
        if (haveCustomerGeo && a.geolocation && b.geolocation) {
          const dA = haversineKm(customerLat, customerLng, a.geolocation.lat, a.geolocation.lng);
          const dB = haversineKm(customerLat, customerLng, b.geolocation.lat, b.geolocation.lng);
          return dA - dB;
        }
        // No geo data — keep "default" first, then alphabetical.
        if (a.id === DEFAULT_BRANCH_ID) return -1;
        if (b.id === DEFAULT_BRANCH_ID) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      const pickBranchForItem = async (productId: string, quantity: number): Promise<string> => {
        for (const branch of sortedBranches) {
          const { stock } = await getStockForBranch(productId, branch.id);
          if (stock >= quantity) return branch.id;
        }
        return DEFAULT_BRANCH_ID;
      };

      // Populate pending order details for FlowResult.tsx to consume after payment.
      // Each item carries its own branchId so the stock decrement happens against the
      // right sucursal.
      const checkoutCart = await Promise.all(cart.map(async (item) => {
        const p = products.find(prod => prod.id === item.id);
        const moq = p?.wholesaleMinQty || 6;
        const reachedMOQ = item.quantity >= moq;
        const price = (reachedMOQ && p?.wholesalePrice)
          ? Number(p.wholesalePrice)
          : Number(item.price);
        const branchId = await pickBranchForItem(item.id, item.quantity);
        return {
          ...item,
          price: price,
          stock: p?.stock || 0,
          maxStock: p?.maxStock || 100,
          branchId,
        };
      }));

      setStorageJSON(STORAGE_KEYS.pendingOrderCart, checkoutCart);
      setStorageJSON(STORAGE_KEYS.pendingOrderPayments, [{ method: "flow", amount: finalCartTotal }]);
      if (appliedCoupon) {
        setStorageJSON(STORAGE_KEYS.pendingOrderCoupon, appliedCoupon);
      } else {
        removeStorage(STORAGE_KEYS.pendingOrderCoupon);
      }
      
      const response = await fetch("/api/flow/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalCartTotal,
          email: customer.email.trim().toLowerCase(),
          description,
          externalId: `ORD-${Date.now()}`,
          baseUrl: baseUrl
        })
      });

      const data = await response.json();
      if (data.url) {
        // Close alert before redirect
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
        // Brief delay for the animation
        setTimeout(() => {
          window.location.href = data.url;
        }, 800);
      } else {
        throw new Error(data.error || "No se pudo iniciar el pago");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la compra");
      setAlertConfig(prev => ({ ...prev, isOpen: false }));
    } finally {
      // Keep loading true until redirect or show error
      if (window.location.href.includes("flow.cl")) return;
      setLoading(false);
    }
  };

  // --- Tier 5.A4.2: Firebase Auth handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      // onAuthStateChanged listener picks up the user → loads /customers/{uid}.
    } catch (err: any) {
      const code = err.code;
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        setError("Email o contraseña incorrectos.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera unos minutos.");
      } else if (code === "auth/network-request-failed") {
        setError("Sin conexión a internet.");
      } else {
        setError("Error al iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!name.trim()) {
      setError("Ingresa tu nombre.");
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      // Step 2: install the custom claim {role: "customer"} via our narrow endpoint.
      // We do this BEFORE writing /customers/{uid} so the create rule's request.auth.token.role
      // check passes (if/when we add that constraint in the future).
      const idToken = await cred.user.getIdToken();
      const claimRes = await fetch("/api/customer/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });
      if (!claimRes.ok) {
        const errBody = await claimRes.json().catch(() => ({}));
        throw new Error(errBody?.error || "No se pudo completar el registro de cliente.");
      }

      // Step 3: write the profile doc. Schema matches the firestore.rules create allowlist.
      await setDoc(doc(db, "customers", cred.user.uid), {
        uid: cred.user.uid,
        email: normalizedEmail,
        name: name.trim(),
        phone: "",
        rut: "",
        address: "",
        points: 0,
        balance: 0,
        createdAt: new Date().toISOString()
      });

      // Force refresh ID token so the new claim is visible immediately.
      await cred.user.getIdToken(true);

      setSuccess("¡Cuenta creada! Bienvenido a StockFlow.");
      // onAuthStateChanged will pick up the user; the customer listener below loads the profile.
    } catch (err: any) {
      const code = err.code;
      if (code === "auth/email-already-in-use") {
        setError("Este email ya tiene cuenta. Inicia sesión o recupera tu contraseña.");
      } else if (code === "auth/invalid-email") {
        setError("Email con formato inválido.");
      } else if (code === "auth/weak-password") {
        setError("Contraseña muy débil (mínimo 6 caracteres).");
      } else if (code === "auth/network-request-failed") {
        setError("Sin conexión a internet.");
      } else {
        setError(err?.message || "Error al crear cuenta.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Ingresa tu email para enviarte el correo de restablecimiento.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSuccess("Te enviamos un correo para restablecer tu contraseña.");
      setTimeout(() => setMode("login"), 4500);
    } catch (err: any) {
      const code = err.code;
      if (code === "auth/user-not-found") {
        // For privacy, do NOT confirm the email is registered. Show the same success.
        setSuccess("Te enviamos un correo para restablecer tu contraseña.");
        setTimeout(() => setMode("login"), 4500);
      } else if (code === "auth/invalid-email") {
        setError("Email con formato inválido.");
      } else {
        setError("No se pudo enviar el correo. Verifica tu conexión.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!rut.trim()) {
      setError(lang === "es" ? "Ingresa tu RUT para activar tu cuenta." : "Enter your RUT to activate your account.");
      return;
    }
    if (!validateChileanRUT(rut)) {
      setError(lang === "es" ? "❌ RUT inválido (Dígito verificador incorrecto)" : "❌ Invalid RUT (Bad check-digit)");
      return;
    }
    setLoading(true);
    try {
      // POST /api/customer/activate-request — server-side uniform response.
      // Network failure is the only thing we differentiate; the server NEVER
      // tells us whether the RUT exists.
      const resp = await fetch("/api/customer/activate-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: rut.trim() })
      });
      if (!resp.ok) {
        throw new Error("server-error");
      }
      const body = await resp.json().catch(() => ({}));
      setSuccess(body?.message || (lang === "es" ? "Si tu RUT está registrado, te enviamos un correo con instrucciones." : "If your RUT is registered, we have sent you an email with instructions."));
      setTimeout(() => setMode("login"), 5000);
    } catch (err) {
      setError(lang === "es" ? "No se pudo procesar la solicitud. Verifica tu conexión y vuelve a intentar." : "Could not process request. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
    // setAuthUser and setCustomer get cleared via onAuthStateChanged.
  };

  // Tier 5.A4.2: subscribe to Firebase Auth state — single source of truth.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
      if (!u) {
        setCustomer(null);
      }
    });
    return unsub;
  }, []);

  // Tier 5.A4.2: subscribe to the /customers/{uid} profile when authenticated.
  // The doc is created by handleRegister; for migrated users it exists already
  // under their Auth uid (the migration script wrote it). Real-time updates from
  // FlowResult (points, segment, totalSpent) flow through this listener.
  useEffect(() => {
    if (!authUser?.uid) return;
    const ref = doc(db, "customers", authUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCustomer({ id: snap.id, ...snap.data() });
        return;
      }
      // Tier 5.A4.4: distinguish "staff user landed on customer portal by
      // mistake" from "customer without a profile yet" — without this branch
      // the UI silently re-renders the Login screen and the user is stuck
      // with an active Firebase session but no apparent way in.
      const STAFF_ROLES = ["owner", "admin", "manager", "seller", "logistics", "driver"];
      authUser
        .getIdTokenResult()
        .then((t) => {
          const role = (t.claims as Record<string, unknown>)?.role;
          if (typeof role === "string" && STAFF_ROLES.includes(role)) {
            signOut(auth).catch(() => {});
            setError(
              "Esta cuenta es del personal interno. Inicia sesión en el panel administrativo, no en el portal de cliente."
            );
          } else {
            setError(
              "Tu cuenta de cliente no tiene perfil asociado. Si compraste en la tienda, usa “Activar mi cuenta”. Si nunca compraste, regístrate."
            );
          }
        })
        .catch(() => {
          setError("No pudimos verificar tu cuenta. Intenta nuevamente.");
        });
      setCustomer(null);
    });
    return unsub;
  }, [authUser?.uid]);

  useEffect(() => {
    if (customer?.id) {
      const q = query(
        collection(db, "transactions"),
        where("customerId", "==", customer.id),
        orderBy("timestamp", "desc"),
        limit(10)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return unsub;
    }
  }, [customer?.id]);

  // Sync redemptions in real-time
  useEffect(() => {
    if (customer?.id) {
      const q = query(
        collection(db, "redemptions"),
        where("customerId", "==", customer.id)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
          });
        setRedemptions(sorted);
      });
      return unsub;
    }
  }, [customer?.id]);

  // Sync customer claims in real-time
  useEffect(() => {
    if (customer?.id) {
      const q = query(
        collection(db, "claims"),
        where("customerId", "==", customer.id)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
          });
        setClaimsList(sorted);
      });
      return unsub;
    }
  }, [customer?.id]);

  // Tier 5.A4.2: spinner while Firebase Auth is determining the initial state.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" aria-label={t[lang].loading}>
        <div className="size-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" aria-hidden="true" />
      </div>
    );
  }

  // Tier 5.C.6: authenticated but /customers snapshot still in flight — show
  // the same spinner (NOT the Login form). Avoids the cold-start flash where
  // an already-logged-in customer briefly sees the login screen.
  if (authUser && customer === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" aria-label={t[lang].loadingProfile}>
        <div className="size-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" aria-hidden="true" />
      </div>
    );
  }

  // Not signed in (or signed in but profile doc not yet loaded) → show
  // Login / Register / Recover screens, mode-switched.
  if (!authUser || !customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-10">
            <div className="size-20 bg-orange-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-orange-200">
              <Smartphone size={40} aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{settings.businessName || "StockFlow"} <span className="text-orange-600">{t[lang].brandVersionText}</span></h1>
            <p className="text-slate-500 font-medium mt-2">
              {mode === "login" && t[lang].accountBenefits}
              {mode === "register" && t[lang].createAccountSeconds}
              {mode === "recover" && t[lang].recoverAccess}
              {mode === "activate" && t[lang].activateLegacyAccount}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleLogin}
                className="space-y-4"
                aria-label={lang === "es" ? "Formulario de inicio de sesión" : "Login form"}
              >
                <div className="space-y-1.5">
                  <label htmlFor="customer-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].emailLabel}</label>
                  <input
                    id="customer-email"
                    autoFocus
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@correo.cl"
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    aria-label={t[lang].emailLabel}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="customer-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].passwordLabel}</label>
                  <div className="relative">
                    <input
                      id="customer-password"
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 pr-12 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-label={t[lang].passwordLabel}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center px-4 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  aria-label={t[lang].login}
                >
                  {loading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" aria-hidden="true" />
                  ) : (
                    t[lang].login
                  )}
                </button>

                <div className="flex flex-col gap-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode("activate"); setError(""); setSuccess(""); setPassword(""); }}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 uppercase tracking-widest"
                    aria-label={t[lang].boughtInStoreActivate}
                  >
                    {t[lang].boughtInStoreActivate}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(""); setSuccess(""); setPassword(""); }}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-widest"
                    aria-label={t[lang].notRegisteredYet}
                  >
                    {t[lang].notRegisteredYet}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("recover"); setError(""); setSuccess(""); setPassword(""); }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest"
                    aria-label={t[lang].forgotPasswordQuestion}
                  >
                    {t[lang].forgotPasswordQuestion}
                  </button>
                </div>
              </motion.form>
            )}

            {mode === "register" && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegister}
                className="space-y-4"
                aria-label={lang === "es" ? "Formulario de registro" : "Registration form"}
              >
                <div className="space-y-1.5">
                  <label htmlFor="register-name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].fullNameLabel}</label>
                  <input
                    id="register-name"
                    autoFocus
                    type="text"
                    required
                    autoComplete="name"
                    maxLength={100}
                    placeholder={t[lang].fullNamePlaceholder}
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    aria-label={t[lang].fullNameLabel}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="register-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].emailLabel}</label>
                  <input
                    id="register-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@correo.cl"
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    aria-label={t[lang].emailLabel}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="register-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].passwordMin}</label>
                  <div className="relative">
                    <input
                      id="register-password"
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 pr-12 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      aria-label={t[lang].passwordLabel}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center px-4 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password || !name}
                  className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  aria-label={lang === "es" ? "Crear cuenta" : "Create account"}
                >
                  {loading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" aria-hidden="true" />
                  ) : (
                    lang === "es" ? "Crear cuenta" : "Create account"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); setPassword(""); }}
                  className="w-full text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest pt-2"
                  aria-label={t[lang].alreadyHaveAccount}
                >
                  {t[lang].alreadyHaveAccount}
                </button>
              </motion.form>
            )}

            {mode === "activate" && (
              <motion.form
                key="activate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleActivateRequest}
                className="space-y-4"
                aria-label={lang === "es" ? "Formulario de activación de cuenta" : "Account activation form"}
              >
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 mb-4">
                  <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                    {t[lang].activateNotice}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="activate-rut" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].rut}</label>
                  <input
                    id="activate-rut"
                    autoFocus
                    type="text"
                    required
                    inputMode="text"
                    maxLength={20}
                    placeholder="12.345.678-9"
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 transition-all shadow-sm"
                    value={rut}
                    onChange={(e) => {
                      const formatted = formatRUT(e.target.value);
                      setRut(formatted);
                      setError("");
                    }}
                    aria-label={t[lang].rut}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center px-4 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !rut.trim()}
                  className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  aria-label={t[lang].sendActivationEmail}
                >
                  {loading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" aria-hidden="true" />
                  ) : (
                    t[lang].sendActivationEmail
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); setRut(""); }}
                  className="w-full text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest pt-2"
                  aria-label={t[lang].backToLogin}
                >
                  {t[lang].backToLogin}
                </button>
              </motion.form>
            )}

            {mode === "recover" && (
              <motion.form
                key="recover"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
                aria-label={lang === "es" ? "Formulario de recuperación de contraseña" : "Password recovery form"}
              >
                <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 mb-4">
                  <p className="text-[11px] font-bold text-orange-900 leading-relaxed">
                    {t[lang].enterEmailReset}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="recover-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].emailLabel}</label>
                  <input
                    id="recover-email"
                    autoFocus
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@correo.cl"
                    className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 transition-all shadow-sm"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    aria-label={t[lang].emailLabel}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center px-4 bg-rose-50 py-2 rounded-xl border border-rose-100">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center px-4 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  aria-label={t[lang].sendRecoverEmail}
                >
                  {loading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" aria-hidden="true" />
                  ) : (
                    t[lang].sendRecoverEmail
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="w-full text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest pt-2"
                  aria-label={t[lang].backToLogin}
                >
                  {t[lang].backToLogin}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-12">
            Sf Shop • Dy Family • {new Date().getFullYear()}
          </p>
          <p className="text-center text-[9px] text-slate-300 font-medium italic mt-1">
            {t[lang].slogan}
          </p>
        </motion.div>
      </div>
    );
  }

  const tier = getCustomerTier(customer.points);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-32 pb-[calc(6rem+env(safe-area-inset-bottom))] relative overflow-x-hidden">
      {/* Dynamic FCM Toast Notification */}
      <AnimatePresence>
        {fcmToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-4 right-4 z-[200] max-w-sm mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white rounded-3xl p-4.5 shadow-2xl flex items-start gap-x-3.5"
          >
            <div className="w-9.5 h-9.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Bell size={18} className="animate-soft-bounce" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[9px] font-black text-[#10b981] uppercase tracking-widest">{fcmToast.title}</p>
              <p className="text-xs text-slate-200 mt-1 font-semibold leading-normal">{fcmToast.body}</p>
            </div>
            <button 
              type="button"
              onClick={() => setFcmToast(null)}
              className="text-slate-400 hover:text-white font-heavy transition-colors text-xs p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Sidebar Drawer */}
      <AnimatePresence>
        {isProfileSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex justify-start">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Side Drawer Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-80 h-full max-w-[85%] bg-white border-r border-slate-100 flex flex-col shadow-2xl z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-800 tracking-tight leading-none">{t[lang].myAccount}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t[lang].configAndSupport}</p>
                </div>
                <button type="button" 
                  onClick={() => setIsProfileSidebarOpen(false)}
                  className="p-2 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-150 transition-all active:scale-95 shadow-sm"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {/* Profile Brief Card */}
                <div className="bg-white rounded-[2rem] border border-slate-150 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-x-3.5 pb-3 border-b border-slate-50">
                    <div className="relative group shrink-0">
                      <div className="size-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden relative border border-slate-100">
                        {isUploadingPhoto ? (
                          <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : customer.photoURL ? (
                          <img src={customer.photoURL} alt={customer.name} className="w-full h-full object-cover" />
                        ) : (
                          customer.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <input 
                        type="file" 
                        id="customer-photo-upload-sidebar"
                        onChange={handlePhotoUpload}
                        className="hidden" 
                        accept="image/*"
                        disabled={isUploadingPhoto}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("customer-photo-upload-sidebar");
                          if (el) el.click();
                        }}
                        className="absolute -bottom-1 -right-1 p-1 bg-white rounded-lg border border-slate-250 shadow-md text-slate-500 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
                        disabled={isUploadingPhoto}
                        title={t[lang].uploadProfilePhoto}
                      >
                        <Camera size={11} />
                      </button>
                    </div>
                    <div className="text-left overflow-hidden">
                      <h4 className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1.5 justify-start">
                        {customer.name}
                        {customer.photoVerified && (
                          <CheckCircle size={13} className="text-emerald-500 fill-emerald-50 shrink-0" title={t[lang].profileVerified} />
                        )}
                      </h4>
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none mt-1">{t[lang].memberTier(tier.name)}</p>
                      {customer.photoVerified ? (
                        <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mt-1 inline-block">✓ {t[lang].idVerifiedBadge}</span>
                      ) : (
                        <p className="text-[8px] font-medium text-slate-400 mt-0.5 whitespace-normal leading-tight">{t[lang].uploadPhotoToVerify}</p>
                      )}
                    </div>
                  </div>

                  {/* RUT & Contact Details (Read only) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="text-left">
                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{t[lang].registeredRut}</p>
                        <span className="text-[11px] font-semibold text-slate-700">
                          {customer.rut || customer.taxId
                            ? formatRUT(customer.rut || customer.taxId)
                            : (lang === "es" ? "No registrado" : "Not registered")}
                        </span>
                      </div>
                      <Lock size={12} className="text-slate-350" />
                    </div>
                    {customer.phone && (
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-left">
                          <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{t[lang].linkedPhone}</p>
                          <p className="text-[11px] font-semibold text-slate-700">{customer.phone}</p>
                        </div>
                        <Lock size={12} className="text-slate-350" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Contact details inside Drawer */}
                <div className="space-y-3.5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">{t[lang].editContactData}</h4>
                  
                  <div className="space-y-3.5 p-5 bg-slate-50 rounded-[2rem] border border-slate-150 text-left shadow-inner">
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest ml-0.5">{t[lang].emailInvoices}</label>
                      <input 
                        type="email" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest ml-0.5">{t[lang].billingType}</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm appearance-none"
                        value={profileType}
                        onChange={(e) => setProfileType(e.target.value as any)}
                      >
                        <option value="retail">{t[lang].retailPerson}</option>
                        <option value="wholesale">{t[lang].wholesaleCompany}</option>
                      </select>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (!profileEmail.includes("@")) {
                          setAlertConfig({
                            isOpen: true,
                            type: "error",
                            title: "Correo Inválido",
                            message: "Por favor ingresa un correo electrónico válido."
                          });
                          return;
                        }
                        setIsSavingProfile(true);
                        try {
                          await updateDoc(doc(db, "customers", customer.id), { 
                            email: profileEmail.trim().toLowerCase(),
                            type: profileType
                          });
                          const updated = {
                            ...customer,
                            email: profileEmail.trim().toLowerCase(),
                            type: profileType
                          };
                          // Tier 5.A4.2: optimistic UI; Firestore listener reconfirms.
                          setCustomer(updated);
                          setAlertConfig({
                            isOpen: true,
                            type: "success",
                            title: "¡Perfil Guardado! 🎉",
                            message: "Tus datos de contacto se actualizaron exitosamente."
                          });
                        } catch (err) {
                          console.error("Error updating profile", err);
                          setAlertConfig({
                            isOpen: true,
                            type: "error",
                            title: "Error al guardar",
                            message: "Ocurrió un error al actualizar los datos en la base de datos."
                          });
                        } finally {
                          setIsSavingProfile(false);
                        }
                      }}
                      disabled={isSavingProfile || (profileEmail === customer.email && profileType === customer.type)}
                      className={cn(
                        "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-x-1.5 border shadow-sm mt-3",
                        (profileEmail === customer.email && profileType === customer.type)
                          ? "bg-slate-150 text-slate-350 border-slate-200 cursor-not-allowed shadow-none"
                          : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 active:scale-95"
                      )}
                    >
                      {isSavingProfile ? (
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Star size={12} />
                          <span>{t[lang].saveChanges}</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Account Navigation Shortcuts */}
                <div className="space-y-2.5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">{t[lang].accountAccessHeader}</h4>
                  
                  <button type="button"
                    onClick={() => {
                      setActiveTab("rewards");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-x-3 text-slate-700 font-bold text-xs">
                      <div className="size-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shadow-inner shrink-0">
                        <Gift size={15} />
                      </div>
                      <span className="group-hover:text-amber-700 font-black">{t[lang].rewardsRedemptionMenu}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button type="button"
                    onClick={() => {
                      setActiveTab("offers");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-x-3 text-slate-700 font-bold text-xs">
                      <div className="size-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-inner shrink-0">
                        <Tag size={15} />
                      </div>
                      <span className="group-hover:text-indigo-750 font-black">{t[lang].activeCouponsMenu}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button type="button"
                    onClick={() => {
                      setActiveTab("history");
                      setIsProfileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-150 rounded-2xl transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-x-3 text-slate-700 font-bold text-xs">
                      <div className="size-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shadow-inner shrink-0">
                        <History size={15} />
                      </div>
                      <span className="group-hover:text-emerald-700 font-black">{t[lang].viewReceipts}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Configuration / Password Info card inside menu */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-left space-y-1.5">
                  <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{t[lang].accountSecurity}</p>
                  <p className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                    <Lock size={12} className="text-slate-400" />
                    Contraseña de Acceso
                  </p>
                  <p className="text-[9px] font-medium text-slate-500 leading-normal">
                    Tu acceso móvil está resguardado de forma ultra segura. Solicita el cambio o reinicio de claves directamente en la caja física de nuestra tienda.
                  </p>
                </div>
              </div>

              {/* Drawer Footer controls */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col space-y-4">
                <button type="button"
                  onClick={() => {
                    logout();
                    setIsProfileSidebarOpen(false);
                  }}
                  className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-rose-100 transition-all flex items-center justify-center gap-x-2 active:scale-95 shadow-sm shadow-rose-50"
                >
                  <LogOut size={13} />
                  <span>{t[lang].closeSessionMobile}</span>
                </button>
                
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-350 uppercase tracking-wider">
                    {settings.businessName || "StockFlow"} • {t[lang].brandVersionText} • v2.5.0
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-50">
        <button type="button" 
          onClick={() => setIsProfileSidebarOpen(true)}
          className="flex items-center gap-x-3 text-left hover:bg-slate-50/80 p-2 -m-2 rounded-2xl transition-all duration-200 active:scale-95 group focus:outline-hidden"
        >
          <div className="size-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg overflow-hidden relative shadow-sm ring-2 ring-slate-100 group-hover:ring-indigo-100 transition-all shrink-0">
            {customer.photoURL ? (
              <img src={customer.photoURL} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              customer.name?.charAt(0).toUpperCase()
            )}
            {customer.photoVerified && (
              <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-[7px] text-white font-bold">✓</span>
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1 font-bold">
              <h2 className="text-sm font-black text-slate-900 truncate max-w-[150px] group-hover:text-indigo-650 transition-colors">{t[lang].welcomeUser(customer.name?.split(' ')[0] || "")}</h2>
              <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">{t[lang].levelLabel} {tier.name}</p>
          </div>
        </button>

        <div className="flex items-center gap-x-2">
          <button type="button"
            onClick={() => setLang(prev => prev === "es" ? "en" : "es")}
            className="px-3.5 py-2 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 rounded-2xl transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-indigo-100/50 shadow-inner"
            title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
          >
            🌐 {lang === "es" ? "EN" : "ES"}
          </button>
          
          <button type="button" 
            onClick={() => setShowNotifications(true)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all relative active:scale-95"
          >
            <Bell size={18} />
            {hasUnread && (
              <div className="absolute top-3 right-3 size-2 bg-rose-500 rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* Banner de Reclamos Resueltos */}
        <AnimatePresence>
          {claimsList
            .filter((c) => (c.status === "resolved" || c.status === "approved") && c.resolutionNote && !dismissedClaims.includes(c.id))
            .map((claim) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="overflow-hidden"
              >
                <div className="bg-emerald-600 text-white p-5 rounded-[2rem] border border-emerald-700 shadow-lg shadow-emerald-600/10 flex flex-col gap-3 relative text-left">
                  <button
                    type="button"
                    onClick={() => dismissClaim(claim.id)}
                    className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                    title={t[lang].closeNotification}
                  >
                    <X size={14} />
                  </button>
                  
                  <div className="flex items-start gap-x-3 pr-6">
                    <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-white">
                      <CheckCircle size={18} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-100">{t[lang].claimResolvedTitle}</h4>
                      <h3 className="text-xs font-black text-white leading-snug">{t[lang].claimResolvedMsg(claim.orderId ? claim.orderId.substring(0,8).toUpperCase() : "S/N")}</h3>
                      <p className="text-[9px] font-bold text-emerald-150 uppercase tracking-widest">{t[lang].reasonLabel}: {claim.reason}</p>
                    </div>
                  </div>

                  <div className="bg-black/10 p-4 rounded-2xl border border-white/5 space-y-1 mt-1">
                    <span className="text-[8.5px] font-black text-emerald-250 uppercase tracking-widest leading-none">{t[lang].fulfillmentResponse}</span>
                    <p className="text-xs text-white font-extrabold leading-normal">
                      "{claim.resolutionNote}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[8px] text-emerald-200 font-bold uppercase tracking-wider">
                      {lang === "es" ? `¡Gracias por preferir ${settings.businessName || "nuestra tienda"}!` : `Thank you for choosing ${settings.businessName || "our store"}!`}
                    </p>
                    <button
                      type="button"
                      onClick={() => dismissClaim(claim.id)}
                      className="px-4 py-1.5 bg-white text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors shadow-xs"
                    >
                      {t[lang].understood}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* Point Card */}
              <LoyaltyCard
                points={customer.points || 0}
                tierName={tier.name as any}
                pointsToNext={
                  tier.name === "Platinum" ? 0 :
                  tier.name === "Gold" ? 5000 - (customer.points || 0) :
                  tier.name === "Silver" ? 2000 - (customer.points || 0) :
                  500 - (customer.points || 0)
                }
                nextTier={
                  tier.name === "Platinum" ? "" :
                  tier.name === "Gold" ? "Platinum" :
                  tier.name === "Silver" ? "Gold" :
                  "Silver"
                }
                rut={customer.taxId || ""}
                memberSince={customer.timestamp ? toDate(customer.timestamp).getFullYear().toString() : "2024"}
                onShowQR={() => setIsQRSheetOpen(true)}
                lang={lang}
              />

              {/* FCM Push Notifications Control Card */}
              <div className="bg-gradient-to-r from-slate-900 to-[#2a1200] text-white p-6 rounded-[2.5rem] border border-orange-500/10 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-x-4">
                  <div className={`size-12 rounded-2xl flex items-center justify-center border transition-all ${fcmRegistered ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse"}`}>
                    <Bell size={20} className={fcmLoading ? "animate-spin" : ""} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#10b981]">{t[lang].pushNotifications}</h4>
                    <p className="text-xs text-slate-300 mt-1 font-bold">
                      {fcmRegistered ? t[lang].pushSubscribed : t[lang].pushUnsubscribed}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {fcmRegistered ? t[lang].pushActiveNotice : t[lang].pushInactiveNotice}
                    </p>
                  </div>
                </div>

                {!fcmRegistered ? (
                  <button type="button"
                    onClick={handleActivateNotifications}
                    disabled={fcmLoading}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer active:scale-95 text-white shadow-lg shadow-orange-600/30"
                  >
                    {fcmLoading ? t[lang].connecting : t[lang].activateBtn}
                  </button>
                ) : (
                  <span className="px-3.5 py-1.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-2xl border border-emerald-500/30 shadow-xs">
                    ✓ {t[lang].activeStatus}
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" 
                  onClick={() => setActiveTab("rewards")}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center space-y-3 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Gift size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{t[lang].redeem}</span>
                </button>
                <button type="button" 
                  onClick={() => setActiveTab("shop")}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center space-y-3 active:scale-95 transition-transform"
                >
                  <div className="size-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <ShoppingCart size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{t[lang].buy}</span>
                </button>
              </div>

              {/* Exclusive Offers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t[lang].offersForYou}</h3>
                  <button type="button" onClick={() => setActiveTab("offers")} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t[lang].viewAll}</button>
                </div>
                <div className="space-y-3">
                  {loadingCoupons ? (
                    <div className="space-y-3">
                      <div className="w-full h-24 bg-slate-100 rounded-[2rem] animate-pulse" />
                      <div className="w-full h-24 bg-slate-100 rounded-[2rem] animate-pulse" />
                    </div>
                  ) : (() => {
                    const eligibleRealCoupons = coupons.filter(c => {
                      const minPointsRequired = (LOYALTY_TIERS as any)[c.minTier]?.min || 0;
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(c.code);
                      return (customer?.points || 0) >= minPointsRequired && !isUsed;
                    }).slice(0, 2);

                    const unlockedAutoCoupons = AUTOMATIC_POINT_COUPONS.filter(c => {
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(c.code);
                      return (customer?.points || 0) >= c.requiredPoints && !isUsed;
                    }).slice(0, 2);
                    const nextLockedAutoCoupon = AUTOMATIC_POINT_COUPONS.find(c => (customer?.points || 0) < c.requiredPoints);

                    const hasUnlocked = eligibleRealCoupons.length > 0 || unlockedAutoCoupons.length > 0;

                    return (
                      <>
                        {/* Unlocked Automatic Point-Based Coupons */}
                        {unlockedAutoCoupons.map((auto) => (
                          <button type="button"
                            key={auto.id}
                            onClick={() => {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: auto.title,
                                message: t[lang].loyaltyCouponMessage(auto.code, auto.desc)
                              });
                            }}
                            className="w-full p-5 rounded-[2rem] text-left text-white flex items-center justify-between shadow-lg bg-emerald-600 shadow-emerald-100 transition-all active:scale-95 duration-200"
                          >
                            <div className="flex items-center gap-x-4">
                              <div className="text-2xl">{auto.img}</div>
                              <div>
                                <h4 className="font-bold text-sm">{auto.title}</h4>
                                <p className="text-[9px] opacity-90 uppercase font-black tracking-widest mt-0.5">
                                  {auto.desc} • {lang === "es" ? "Código" : "Code"}: {auto.code}
                                </p>
                              </div>
                            </div>
                            <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <Star size={18} className="fill-current text-white" />
                            </div>
                          </button>
                        ))}

                        {/* Unlocked Real Company Coupons */}
                        {eligibleRealCoupons.map((coupon) => (
                          <button type="button"
                            key={coupon.id}
                            onClick={() => {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: coupon.title,
                                message: t[lang].businessCouponMessage(coupon.code, coupon.desc)
                              });
                            }}
                            className="w-full p-5 rounded-[2rem] text-left text-indigo-900 border border-indigo-100 bg-indigo-50 flex items-center justify-between transition-all active:scale-95 duration-200"
                          >
                            <div className="flex items-center gap-x-4">
                              <div className="text-2xl">{coupon.img || "🎟️"}</div>
                              <div>
                                <h4 className="font-bold text-sm text-indigo-950">{coupon.title}</h4>
                                <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>{coupon.desc} • {lang === "es" ? "Código" : "Code"}: {coupon.code}</span>
                                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-2 py-0.5 rounded-full">
                                    ✓ {t[lang].registeredInSystem}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="size-10 bg-indigo-100/50 text-indigo-600 rounded-xl flex items-center justify-center">
                              <Star size={18} className="fill-current" />
                            </div>
                          </button>
                        ))}

                        {/* Always show next locked loyalty coupon progress goal if exists */}
                        {nextLockedAutoCoupon && (
                          <div className="p-5 rounded-[2rem] border border-dashed border-slate-200 bg-white shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-x-4">
                              <div className="text-3xl opacity-60">{nextLockedAutoCoupon.img}</div>
                              <div>
                                <h4 className="font-bold text-xs text-slate-700">{nextLockedAutoCoupon.title}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  {t[lang].pointsMissingForCoupon(nextLockedAutoCoupon.requiredPoints - (customer?.points || 0), nextLockedAutoCoupon.desc)}
                                </p>
                                <div className="w-48 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                  <div 
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-300" 
                                    style={{ width: `${Math.min(100, ((customer?.points || 0) / nextLockedAutoCoupon.requiredPoints) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="text-slate-300"><Lock size={16} /></div>
                          </div>
                        )}

                        {/* Show next upcoming locked company coupon if any */}
                        {coupons.filter(c => !eligibleRealCoupons.some(erc => erc.id === c.id)).slice(0, 1).map((lockedC) => {
                          const minPointsNeeded = (LOYALTY_TIERS as any)[lockedC.minTier]?.min || 0;
                          return (
                            <div key={lockedC.id} className="p-5 rounded-[2rem] border border-slate-100 bg-slate-50 flex items-center justify-between opacity-60">
                              <div className="flex items-center gap-x-4">
                                <div className="text-2xl">{lockedC.img || "🎟️"}</div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-800">{lockedC.title}</h4>
                                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                                    {t[lang].levelLabel} {lockedC.minTier} ({minPointsNeeded} pts)
                                  </p>
                                </div>
                              </div>
                              <div className="text-slate-400"><Lock size={16} /></div>
                            </div>
                          );
                        })}

                        {!hasUnlocked && coupons.length === 0 && (
                          <div className="p-5 text-center text-slate-400 rounded-3xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                              {t[lang].pointsNoticeCart}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "shop" && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-x-3">
                  <button type="button" onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">{t[lang].shop}</h3>
                </div>
                {cart.length > 0 && (
                  <button type="button" 
                    onClick={() => setShowCart(true)}
                    className="bg-orange-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black animate-soft-bounce uppercase tracking-wider"
                  >
                    {cart.reduce((a, b) => a + b.quantity, 0)} Items
                  </button>
                )}
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-x-3 text-rose-600"
                >
                  <AlertCircle size={18} />
                  <p className="text-xs font-bold">{error}</p>
                </motion.div>
              )}

              {/* 1. High Performance Custom Search & View Toggle Density */}
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder={t[lang].searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setVisibleCount(24); // Instant query resets pagination offset
                    }}
                    className="w-full bg-white border border-slate-100 rounded-2xl pl-10 pr-10 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all focus:outline-none"
                  />
                  {searchTerm && (
                    <button type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setVisibleCount(24);
                      }}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner shrink-0">
                  <button type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    title={t[lang].viewGrid}
                  >
                    <Grid size={16} />
                  </button>
                  <button type="button"
                    onClick={() => setViewMode("compact")}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      viewMode === "compact" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    title={t[lang].viewList}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* 2. Horizontal Scrolling Carousel of Dynamic Categories */}
              <div className="flex gap-x-2 overflow-x-auto pb-1 scrollbar-none antialiased">
                {productCategories.map((cat) => {
                  const count = cat === "Todos" 
                    ? products.filter(p => p.stock > 0).length 
                    : products.filter(p => p.category === cat && p.stock > 0).length;
                  
                  if (count === 0 && cat !== "Todos") return null;

                  return (
                    <button type="button"
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setVisibleCount(24);
                      }}
                      className={cn(
                        "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                        selectedCategory === cat 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100/50" 
                          : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      {cat === "Todos" ? t[lang].allCategory : cat} <span className={cn("text-[8px] ml-1 opacity-70", selectedCategory === cat ? "text-indigo-200" : "text-slate-400")}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* 3. Result Metadata and Sort selectors */}
              <div className="flex items-center justify-between text-[9px] font-black tracking-wider text-slate-400 px-1 uppercase">
                <span>{t[lang].showingCountOf(Math.min(filteredAndSortedProducts.length, visibleCount), filteredAndSortedProducts.length)}</span>
                <div className="flex items-center gap-x-1">
                  <span>{t[lang].sortByLabel}</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none text-[9px] font-black text-slate-700 focus:ring-0 p-0 pr-4 cursor-pointer focus:outline-none"
                  >
                    <option value="name">{t[lang].sortName}</option>
                    <option value="price-asc">{t[lang].sortPriceAsc}</option>
                    <option value="price-desc">{t[lang].sortPriceDesc}</option>
                    <option value="discount">{t[lang].sortDiscount}</option>
                  </select>
                </div>
              </div>

              {/* 4. Display of catalog based on viewport density selection */}
              {filteredAndSortedProducts.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="text-4xl text-slate-300">🔎</div>
                  <h4 className="font-bold text-sm text-slate-700">{t[lang].noMatchesTitle}</h4>
                  <p className="text-xs text-slate-400">{t[lang].noMatchesDesc}</p>
                  <button type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("Todos");
                    }}
                    className="mt-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    {t[lang].resetFilters}
                  </button>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredAndSortedProducts.slice(0, visibleCount).map((product) => {
                    const cartItem = cart.find(i => i.id === product.id);
                    return (
                      <div key={product.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                        <div className="aspect-square bg-slate-50 rounded-xl mb-3 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform overflow-hidden relative">
                          {product.image ? (
                            <img src={product.image} alt={product.name || "Producto"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span aria-label={product.name || "Producto"}>{product.category === "Bebidas" ? "🥤" : product.category === "Lácteos" ? "🧀" : "🍎"}</span>
                          )}
                          {product.stock <= 5 && (
                            <span className="absolute bottom-1 right-1 bg-amber-500 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest leading-none">
                              Poco Stock ({product.stock})
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
                        <div className="mt-1 mb-3">
                          <p className="text-[11px] font-black text-slate-900">
                            {formatCurrency(product.price)}
                          </p>
                          {product.wholesalePrice && product.wholesalePrice < product.price && (
                            <p className="text-[9px] font-bold text-emerald-600 mt-0.5">
                              {formatCurrency(product.wholesalePrice)} <span className="opacity-60 font-medium">bulto ({product.wholesaleMinQty || 6}+)</span>
                            </p>
                          )}
                        </div>
                        {cartItem ? (
                          <div className="mt-auto flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(product.id, -1)}
                              className="size-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Minus size={14} />
                            </motion.button>
                            <input 
                              type="number"
                              className="w-12 text-center bg-transparent border-none text-xs font-black text-slate-900 focus:ring-0 p-0"
                              value={cartItem.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  const safeVal = Math.min(product.stock, Math.max(0, val));
                                  setCart(prev => {
                                    const out: any[] = [];
                                    for (const i of prev) {
                                      const next = i.id === product.id ? { ...i, quantity: safeVal } : i;
                                      if (next.quantity > 0) out.push(next);
                                    }
                                    return out;
                                  });
                                }
                              }}
                            />
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (cartItem.quantity < product.stock) {
                                  updateQuantity(product.id, 1);
                                } else {
                                  setAlertConfig({
                                    isOpen: true,
                                    type: "warn",
                                    title: "Límite de Stock",
                                    message: `Únicamente hay ${product.stock} unidades de este producto en inventario.`
                                  });
                                }
                              }}
                              className="size-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Plus size={14} />
                            </motion.button>
                          </div>
                        ) : (
                          <button type="button" 
                            onClick={() => addToCart(product)}
                            className="mt-auto w-full py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 transition-colors"
                          >
                            {t[lang].addBtn}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* COMPACT list Layout: Perfect for Wholesale rapid adding without heavy scroll/bloat */
                <div className="space-y-2">
                  {filteredAndSortedProducts.slice(0, visibleCount).map((product) => {
                    const cartItem = cart.find(i => i.id === product.id);
                    return (
                      <div key={product.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:border-indigo-100 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-x-3 flex-1 min-w-0">
                          <div className="size-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl shrink-0 overflow-hidden border border-slate-50">
                            {product.image ? (
                              <img src={product.image} alt={product.name || "Producto"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span aria-label={product.name || "Producto"}>{product.category === "Bebidas" ? "🥤" : product.category === "Lácteos" ? "🧀" : "🍎"}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">{product.name}</h4>
                            <div className="flex items-center gap-x-2 mt-0.5">
                              <span className="text-[11px] font-black text-slate-950">
                                {formatCurrency(product.price)}
                              </span>
                              {product.wholesalePrice && product.wholesalePrice < product.price && (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[7.5px] font-black leading-none">
                                  {t[lang].wholesaleMinUnit(formatCurrency(product.wholesalePrice), product.wholesaleMinQty || 6)} ({t[lang].xWholesale})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {cartItem ? (
                          <div className="flex items-center bg-slate-50 rounded-xl p-0.5 border border-slate-100 shrink-0">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(product.id, -1)}
                              className="size-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500"
                            >
                              <Minus size={11} />
                            </motion.button>
                            <input 
                              type="number"
                              className="w-9 text-center bg-transparent border-none text-[11px] font-black text-slate-900 focus:ring-0 p-0"
                              value={cartItem.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  const safeVal = Math.min(product.stock, Math.max(0, val));
                                  setCart(prev => {
                                    const out: any[] = [];
                                    for (const i of prev) {
                                      const next = i.id === product.id ? { ...i, quantity: safeVal } : i;
                                      if (next.quantity > 0) out.push(next);
                                    }
                                    return out;
                                  });
                                }
                              }}
                            />
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (cartItem.quantity < product.stock) {
                                  updateQuantity(product.id, 1);
                                } else {
                                  setAlertConfig({
                                    isOpen: true,
                                    type: "warn",
                                    title: t[lang].stockLimitTitle,
                                    message: t[lang].stockLimitMessage(product.stock)
                                  });
                                }
                              }}
                              className="size-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600"
                            >
                              <Plus size={11} />
                            </motion.button>
                          </div>
                        ) : (
                          <button type="button" 
                            onClick={() => addToCart(product)}
                            className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 shrink-0 transition-colors"
                          >
                            {t[lang].addBtn}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 5. Pagination / Load more CTA for performance scalability with 1000+ items */}
              {filteredAndSortedProducts.length > visibleCount && (
                <div className="pt-2 text-center">
                  <button type="button"
                    onClick={() => setVisibleCount(idx => idx + 24)}
                    className="px-6 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                  >
                    <span>{t[lang].loadMoreBtn}</span>
                    <Plus size={14} />
                  </button>
                </div>
              )}

              <div className="h-28" />

              {/* Sticky Cart Footer overlay */}
              {cart.length > 0 && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="fixed bottom-24 left-6 right-6 z-50 px-0"
                >
                  <button type="button" 
                    onClick={() => setShowCart(true)}
                    className={cn(
                      "w-full bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between group transition-all relative overflow-hidden",
                      loading && "opacity-80 scale-95"
                    )}
                    disabled={loading}
                  >
                    <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                    
                    <div className="flex items-center gap-x-3 relative z-10">
                      <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                        {loading ? (
                          <div className="size-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ShoppingBag size={24} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 text-indigo-300">
                          {loading ? t[lang].processingBtn : t[lang].reviewOrderBtn}
                        </p>
                        <p className="text-lg font-black">{formatCurrency(cartTotal)}</p>
                      </div>
                    </div>
                    {!loading && (
                      <div className="bg-white/10 rounded-full p-2 relative z-10 group-hover:bg-white/20 transition-colors">
                        <ChevronRight size={28} className="translate-x-0.5" />
                      </div>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "wallet" && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="space-y-6 text-center py-6"
            >
              <div className="size-16 bg-indigo-600 rounded-[1.75rem] flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-100">
                <Wallet size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{t[lang].digitalCardTitle}</h3>
                <p className="text-[11px] font-bold text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  {t[lang].digitalCardNotice}
                </p>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-900 shadow-xl relative overflow-hidden max-w-[320px] mx-auto">
                {/* Security shield decoration */}
                <div className="absolute top-3 right-3 bg-indigo-50 border border-indigo-100/50 rounded-full p-1.5 flex items-center justify-center">
                  <div className="size-2 rounded-full bg-indigo-600 animate-pulse" />
                </div>
                
                {/* Dynamically rotating secure QR Code */}
                <div className="aspect-square bg-slate-50 rounded-3xl mb-4 flex flex-col items-center justify-center p-5 border border-slate-100 relative group">
                  <QRCodeCanvas 
                    value={secureToken || customer.taxId || customer.email} 
                    size={220}
                    level="H"
                    includeMargin={false}
                    className="w-full h-auto"
                  />
                </div>

                {/* Shrinking count-down timer bar indicating dynamic lifetime */}
                <div className="space-y-1.5 mb-5 px-2">
                  <div className="flex justify-between items-center text-[9px] font-black tracking-wider text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} className="text-indigo-500 animate-spin [animation-duration:8s]" />
                      {t[lang].secureDynamicCode}
                    </span>
                    <span className="text-indigo-600 font-extrabold">{t[lang].updateInSeconds(timeLeft)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                </div>

                 {/* 6-Digit visual OTP pin fallback */}
                 <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1 shadow-inner">
                   <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">{t[lang].numericOtpToken}</p>
                   <p className="font-mono text-2xl font-black text-indigo-600 tracking-[0.2em]">{securePin.slice(0,3)} {securePin.slice(3)}</p>
                   <p className="text-[8px] font-bold text-slate-400 leading-normal">
                     {t[lang].manualEntryNotice}
                   </p>
                 </div>
               </div>
 
               {/* Prepaid Balance Section (Paso 3.2) */}
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-150 shadow-sm max-w-[320px] mx-auto text-left space-y-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{t[lang].prepaidDigitalWallet}</p>
                     <h4 className="text-xl font-black text-slate-900 mt-1">
                       {formatCurrency(customer.balance !== undefined ? customer.balance : 25000)}
                     </h4>
                   </div>
                   <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                     <Wallet size={18} />
                   </div>
                 </div>
 
                 <div className="flex gap-2">
                   <button
                     type="button"
                     onClick={async () => {
                       // Simulate rechargeable loading of +$10.000 CLP
                       try {
                         const currentBal = customer.balance !== undefined ? customer.balance : 25000;
                         await updateDoc(doc(db, "customers", customer.id), {
                           balance: currentBal + 10000
                         });
                         setAlertConfig({
                           isOpen: true,
                           type: "success",
                           title: t[lang].chargeSuccessTitle,
                           message: t[lang].chargeSuccessMessage
                         });
                       } catch (err) {
                         console.error(err);
                       }
                     }}
                     className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 transition-colors rounded-xl font-bold text-[10px] text-center"
                   >
                     + $10k CLP
                   </button>
                   <button
                     type="button"
                     onClick={async () => {
                       // Simulate rechargeable loading of +$50.000 CLP
                       try {
                         const currentBal = customer.balance !== undefined ? customer.balance : 25000;
                         await updateDoc(doc(db, "customers", customer.id), {
                           balance: currentBal + 50000
                         });
                         setAlertConfig({
                           isOpen: true,
                           type: "success",
                           title: t[lang].chargeSuccessTitle,
                           message: t[lang].chargeSuccessMessage50
                         });
                       } catch (err) {
                         console.error(err);
                       }
                     }}
                     className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors rounded-xl font-bold text-[10px] text-center"
                   >
                     + $50k CLP
                   </button>
                 </div>
                 <p className="text-[8px] font-bold text-slate-400 text-center leading-normal">
                   {t[lang].simulationNotice}
                 </p>
               </div>

              <div className="flex flex-col space-y-2 max-w-[280px] mx-auto">
                <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-full flex items-center justify-center gap-1 border border-emerald-100">
                  <span>🛡️</span>
                  <span>{t[lang].screenshotProtected}</span>
                </p>
                <button type="button" 
                  onClick={() => setActiveTab("home")}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors py-2"
                >
                  {t[lang].closeCard}
                </button>
              </div>
            </motion.div>
          )}
          {activeTab === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-left"
            >
              <div className="flex items-center gap-x-3 mb-4">
                <button type="button" onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{t[lang].history}</h3>
              </div>

              {/* History Sub-Tabs */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveHistorySubTab("receipts")}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeHistorySubTab === "receipts"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  )}
                >
                  {t[lang].myReceipts}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistorySubTab("claims")}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center justify-center gap-1.5",
                    activeHistorySubTab === "claims"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  )}
                >
                  {t[lang].claimsForm}
                  {claimsList.length > 0 && (
                    <span className="size-2 rounded-full bg-rose-500 border border-white" />
                  )}
                </button>
              </div>

              {activeHistorySubTab === "receipts" ? (
                <div className="space-y-3">
                  {groupedTransactions.map(receipt => {
                    const qtyTotal = receipt.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
                    const displayTitle = receipt.items.map((i: any) => i.productName).join(", ");
                    const displayPoints = Math.floor(receipt.finalOrderTotal / 1000);

                    return (
                      <button type="button" 
                        key={receipt.orderId}
                        onClick={() => setSelectedReceipt(receipt)}
                        className="w-full text-left bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all active:scale-[0.99] duration-200"
                      >
                        <div className="flex items-center gap-x-4 min-w-0 flex-1">
                          <div className="size-12 bg-indigo-50/50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
                            <Receipt size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs truncate text-slate-800 pr-1" title={displayTitle}>
                              {receipt.items.length === 1 
                                ? receipt.items[0].productName 
                                : `${receipt.items[0].productName} ${lang === "es" ? "y" : "and"} ${receipt.items.length - 1} ${lang === "es" ? "más" : "more"}`}
                            </h4>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              {toDate(receipt.timestamp).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US')} • {receipt.documentType}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-x-3 ml-2">
                          <div>
                            <p className="text-xs font-black text-slate-800">
                              {formatCurrency(receipt.finalOrderTotal)}
                            </p>
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                              +{displayPoints} {lang === "es" ? "Puntos" : "Points"}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-slate-350 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    );
                  })}
                  {groupedTransactions.length === 0 && (
                    <div className="text-center py-20 opacity-30">
                      <Search size={48} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">{lang === "es" ? "Aún no tienes compras" : "You have no purchases yet"}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Botón para radicar reclamos con validación */}
                  <button
                    type="button"
                    onClick={() => {
                      setClaimOrderId("");
                      setClaimCustomerTaxId(customer?.taxId || "");
                      setClaimReason("Llegó roto");
                      setClaimDescription("");
                      setClaimPhoto("");
                      setTaxIdError("");
                      setShowClaimModal(true);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    {lang === "es" ? "Radicar Nuevo Reclamo" : "File New Claim"}
                  </button>

                  {/* Informational intro card */}
                  <div className="bg-slate-900 text-white p-5 rounded-[2rem] border border-slate-950 shadow-md">
                    <div className="flex items-start gap-x-3.5">
                      <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 text-amber-400">
                        <AlertCircle size={20} />
                      </div>
                      <div className="text-left space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                          {lang === "es" ? "Garantía de Satisfacción" : "Satisfaction Guarantee"}
                        </h4>
                        <p className="text-[10px] font-medium leading-relaxed opacity-80">
                          {lang === "es" 
                            ? "¿Un producto llegó dañado o faltó en tu envío? No te preocupes. Selecciona una boleta en \"Mis Boletas\" e inicia tu reclamo con foto de evidencia para reembolso inmediato." 
                            : "Did a product arrive damaged or was it missing from your shipment? Don't worry. Select any receipt in \"My Receipts\" and file a claim with photos for immediate replacement."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {claimsList.map(claim => {
                    const statusText = 
                      claim.status === "resolved" || claim.status === "approved" ? (lang === "es" ? "Resuelto / Solucionado" : "Resolved / Approved") :
                      claim.status === "rejected" ? (lang === "es" ? "Cerrado - Rechazado" : "Closed - Rejected") :
                      (lang === "es" ? "Pendiente de Revisión" : "Pending Review");

                    const statusColor = 
                      claim.status === "resolved" || claim.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-250 shadow-sm" :
                      claim.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-250" :
                      "bg-amber-50 text-amber-700 border-amber-250";

                    return (
                      <div 
                        key={claim.id} 
                        className="bg-white p-5 rounded-[2rem] border border-slate-150 shadow-sm flex flex-col gap-4 text-left hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest inline-block">
                              {lang === "es" ? "Reclamo de Compra" : "Purchase Claim"}
                            </span>
                            <h4 className="text-xs font-black text-slate-900 tracking-tight mt-1">
                              {lang === "es" ? "Motivo" : "Reason"}: {
                                claim.reason === "Llegó roto" ? (lang === "es" ? "Llegó roto / dañado" : "Arrived broken / damaged") :
                                claim.reason === "Faltó un producto" ? (lang === "es" ? "Faltó un producto en el envío" : "Missing item in delivery") :
                                claim.reason === "Producto incorrecto" ? (lang === "es" ? "Recibí un producto equivocado" : "Received wrong item") :
                                claim.reason === "Defecto de fábrica" ? (lang === "es" ? "Defecto de calidad/fábrica" : "Quality/Factory defect") :
                                claim.reason === "Otro motivo" ? (lang === "es" ? "Otro inconveniente" : "Other issue") :
                                claim.reason
                              }
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {lang === "es" ? "Orden" : "Order"}: #{claim.orderId.substring(0,8).toUpperCase()} • {toDate(claim.timestamp).toLocaleDateString(lang === "es" ? 'es-CL' : 'en-US')}
                            </p>
                          </div>
                          
                          <span className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", statusColor)}>
                            {statusText}
                          </span>
                        </div>

                        {/* Description */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-650 font-bold leading-normal break-words">
                            "{claim.description}"
                          </p>
                        </div>

                        {/* Thumbnail & Resolution Note */}
                        <div className="flex flex-col gap-3">
                          {claim.photo && (
                            <div className="space-y-1.5 text-left">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t[lang].attachedEvidenceLabel}</p>
                              <div className="relative size-24 rounded-2xl overflow-hidden border border-slate-150 shadow-sm bg-slate-50 group shrink-0">
                                <img 
                                  src={claim.photo} 
                                  alt="Evidencia" 
                                  className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform" 
                                  onClick={() => {
                                    setAlertConfig({
                                      isOpen: true,
                                      type: "info",
                                      title: t[lang].claimEvidenceTitle,
                                      message: t[lang].claimEvidenceDesc
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {claim.resolutionNote && (
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1.5 text-left">
                              <p className="text-[8.5px] font-black text-indigo-700 uppercase tracking-widest leading-none">{t[lang].fulfillmentResponse}</p>
                              <p className="text-xs text-indigo-900 font-extrabold leading-normal">
                                "{claim.resolutionNote}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {claimsList.length === 0 && (
                    <div className="text-center py-16 opacity-30">
                      <AlertCircle size={40} className="mx-auto mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">{t[lang].noClaimsLogged}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "rewards" && (
            <motion.div 
              key="rewards"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-x-3 mb-4">
                <button type="button" 
                  onClick={() => setActiveTab("home")} 
                  className="p-2.5 bg-white rounded-2xl border border-slate-150 shadow-sm active:scale-95 transition-all text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft size={18}/>
                </button>
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{t[lang].rewardsTitle}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t[lang].rewardsSubtitle}</p>
                </div>
              </div>

              {/* Points Summary Card */}
              <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] relative overflow-hidden shadow-xl shadow-slate-950/10">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                  <Gift size={160} className="text-white" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t[lang].pointsAvailable}</h4>
                    <div className="flex items-baseline gap-x-1.5 mt-2">
                      <span className="text-5xl font-black text-amber-400 tracking-tight">{customer.points || 0}</span>
                      <span className="text-xs font-black text-slate-350">PTS</span>
                    </div>
                  </div>
                  <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/15 backdrop-blur-md text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-300">{t[lang].pointsEquivTitle}</p>
                    <p className="text-xs font-bold text-white mt-1">{t[lang].pointsEquivDesc}</p>
                  </div>
                </div>
              </div>

              {/* Sub Tab Buttons */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar gap-1">
                <button
                  type="button"
                  onClick={() => setRewardViewTab("available")}
                  className={cn(
                    "flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-x-1 transition-all whitespace-nowrap",
                    rewardViewTab === "available"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Gift size={13} />
                  <span>{lang === "es" ? "Catálogo" : "Catalog"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRewardViewTab("vouchers")}
                  className={cn(
                    "flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-x-1 transition-all relative whitespace-nowrap",
                    rewardViewTab === "vouchers"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Wallet size={13} />
                  <span>{t[lang].myVouchers}</span>
                  {redemptions.filter(r => r.status === "pending").length > 0 && (
                    <span className="absolute -top-1 -right-1 size-5 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white animate-soft-bounce">
                      {redemptions.filter(r => r.status === "pending").length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRewardViewTab("desafios")}
                  className={cn(
                    "flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-x-1 transition-all whitespace-nowrap",
                    rewardViewTab === "desafios"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Trophy size={13} className="text-amber-500" />
                  <span>{lang === "es" ? "Logros y Desafíos" : "Achievements & Challenges"}</span>
                </button>
              </div>

              {rewardViewTab === "available" && (
                <div className="space-y-6">
                  {/* Category chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
                    {["Todos", "Bebidas", "Lácteos", "Merch", "Otros"].map((cat) => {
                      const count = cat === "Todos" 
                        ? PHYSICAL_REWARDS_CATALOGUE.length
                        : PHYSICAL_REWARDS_CATALOGUE.filter(r => r.category === cat).length;
                      return (
                        <button type="button"
                          key={cat}
                          onClick={() => setRewardCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                            rewardCategory === cat
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                              : "bg-white text-slate-500 border-slate-150 hover:bg-slate-50"
                          )}
                        >
                          {lang === "es" ? cat : (cat === "Todos" ? "All" : cat === "Bebidas" ? "Drinks" : cat === "Lácteos" ? "Dairy" : cat === "Otros" ? "Others" : cat)} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Catalogue Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    {PHYSICAL_REWARDS_CATALOGUE
                      .filter((item) => rewardCategory === "Todos" || item.category === rewardCategory)
                      .map((item) => {
                        const canRedeem = (customer.points || 0) >= item.pointsCost;
                        return (
                          <div 
                            key={item.id} 
                            className="bg-white p-5 rounded-[2.5rem] border border-slate-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
                          >
                            <div className="flex items-center gap-x-4">
                              <div className="size-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner shrink-0 border border-slate-100">
                                {item.emoji}
                              </div>
                              <div className="text-left">
                                <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                                  {lang === "es" ? item.category : (item.category === "Bebidas" ? "Drinks" : item.category === "Lácteos" ? "Dairy" : item.category === "Otros" ? "Others" : item.category)}
                                </span>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight mt-1">{item.name}</h4>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">{item.description}</p>
                              </div>
                            </div>

                            <div className="flex md:flex-col items-center justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                              <div className="flex items-baseline gap-x-1">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">{item.pointsCost}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PTS</span>
                              </div>

                              <button type="button"
                                disabled={!canRedeem || loading}
                                onClick={() => setConfirmReward(item)}
                                className={cn(
                                  "py-3 px-5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                                  canRedeem 
                                    ? "bg-slate-900 text-white hover:bg-orange-600 cursor-pointer shadow-md"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                )}
                              >
                                {canRedeem ? t[lang].redeemRewardBtn : t[lang].pointsMissingReward(item.pointsCost - (customer.points || 0))}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {rewardViewTab === "vouchers" && (
                <div className="space-y-4">
                  {redemptions.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-150 shadow-sm">
                      <div className="size-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Gift size={24} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t[lang].noRedemptions}</p>
                      <button type="button" 
                        onClick={() => setRewardViewTab("available")} 
                        className="mt-4 px-4 py-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 rounded-xl"
                      >
                        {t[lang].viewRewardsCatalog}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 text-left">
                      {redemptions.map((item) => (
                        <div 
                          key={item.id} 
                          className="bg-white rounded-[2.5rem] border border-slate-150 shadow-sm overflow-hidden"
                        >
                          {/* Inner Ticket Card */}
                          <div className="p-6 relative">
                            {/* Decorative punches on sides representing real lottery ticket */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[6px] w-3 h-6 bg-slate-50 rounded-r-full border-r border-y border-slate-150 z-20" />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[6px] w-3 h-6 bg-slate-50 rounded-l-full border-l border-y border-slate-150 z-20" />
                            
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-x-3">
                                <div className="size-12 bg-slate-50 rounded-[1.2rem] flex items-center justify-center text-2xl shadow-inner border border-slate-100 shrink-0">
                                  {PHYSICAL_REWARDS_CATALOGUE.find(r => r.id === item.productId)?.emoji || "🎁"}
                                </div>
                                <div className="text-left">
                                  <h4 className="text-sm font-black text-slate-800 tracking-tight">{item.productName}</h4>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {t[lang].redeemedOn(item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : new Date(item.timestamp).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US'))}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {item.status === "pending" ? (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-x-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                                    {t[lang].pendingPickup}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex items-center">
                                    ✓ {t[lang].delivered}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Ticket barcode container */}
                            <div className="mt-6 pt-5 border-t border-dashed border-slate-200 flex flex-col items-center">
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[150px]">
                                <QRCodeCanvas 
                                  value={JSON.stringify({ code: item.validationCode, rut: item.customerRUT, type: 'redemption' })}
                                  size={100}
                                  level="M"
                                  includeMargin={false}
                                  className="mx-auto"
                                />
                                <span className="font-mono text-sm font-black text-slate-800 tracking-wider mt-3 select-all bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-inner">
                                  {item.validationCode}
                                </span>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider mt-4 leading-relaxed max-w-[240px]">
                                {item.status === "pending" 
                                  ? t[lang].redemptionPickupNotice
                                  : t[lang].redemptionDeliveredNotice}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {rewardViewTab === "desafios" && (
                <div className="space-y-4 text-left">
                  <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-[2.5rem] text-white space-y-2 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-32 bg-amber-450/15 blur-3xl rounded-full -mr-12 -mt-12 animate-pulse" />
                    <div className="flex items-center gap-x-3 relative z-10">
                      <div className="size-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400 border border-white/10 shrink-0">
                        <Trophy size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black tracking-tight text-white">{t[lang].challengesTitle}</h4>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">{t[lang].challengesSubtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* List of Challenges */}
                  {[
                    {
                      id: "comprador_estrella",
                      title: t[lang].chCompradorEstrella,
                      desc: t[lang].chCompradorEstrellaDesc,
                      target: 50000,
                      current: customer.totalSpent || 0,
                      pointsAward: 500,
                      icon: ShoppingBag,
                      style: "indigo"
                    },
                    {
                      id: "eco_boleta",
                      title: t[lang].chEcoBoleta,
                      desc: t[lang].chEcoBoletaDesc,
                      target: 1,
                      current: customer.email ? 1 : 0,
                      pointsAward: 150,
                      icon: Mail,
                      style: "emerald"
                    },
                    {
                      id: "mayorista_pro",
                      title: t[lang].chMayoristaPro,
                      desc: t[lang].chMayoristaProDesc,
                      target: 1000,
                      current: customer.points || 0,
                      pointsAward: 300,
                      icon: Landmark,
                      style: "amber"
                    },
                    {
                      id: "socio_pionero",
                      title: t[lang].chSocioPionero,
                      desc: t[lang].chSocioPioneroDesc,
                      target: 3,
                      current: transactions.length,
                      pointsAward: 400,
                      icon: Ticket,
                      style: "purple"
                    }
                  ].map((ch) => {
                    const isClaimed = customer.claimedChallenges && customer.claimedChallenges.includes(ch.id);
                    const pct = Math.min(100, Math.round((ch.current / ch.target) * 100));
                    const canClaim = pct >= 100 && !isClaimed;

                    return (
                      <div 
                        key={ch.id} 
                        className="bg-white rounded-[2.5rem] border border-slate-150 p-6 shadow-sm flex flex-col space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-x-3.5">
                            <div className={cn(
                              "size-12 rounded-[1.2rem] flex items-center justify-center shrink-0 border border-slate-100",
                              ch.style === "indigo" ? "bg-indigo-50 text-indigo-600" :
                              ch.style === "emerald" ? "bg-emerald-50 text-emerald-600" :
                              ch.style === "amber" ? "bg-amber-50 text-amber-600" :
                              "bg-purple-50 text-purple-600"
                            )}>
                              <ch.icon size={22} />
                            </div>
                            <div>
                              <h5 className="font-black text-slate-800 text-sm tracking-tight leading-snug">{ch.title}</h5>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 leading-normal max-w-[210px]">{ch.desc}</p>
                            </div>
                          </div>
                          <div className="bg-amber-50 border border-amber-250 px-2.5 py-1 rounded-full text-right shrink-0">
                            <span className="text-[9px] font-black text-amber-700">+{ch.pointsAward} PTS</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span>{pct === 100 ? t[lang].completed : `${t[lang].progressLabel}: ${pct}%`}</span>
                            <span>
                              {ch.id === "comprador_estrella" 
                                ? `$${ch.current.toLocaleString('es-CL')} / $${ch.target.toLocaleString('es-CL')}`
                                : `${ch.current} / ${ch.target}`}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pct === 100 ? "bg-emerald-500" : "bg-indigo-600"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {isClaimed ? (
                          <div className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                            {t[lang].challengeClaimedSuccess}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canClaim}
                            onClick={async () => {
                              if (!canClaim) return;
                              try {
                                const currentPoints = customer.points || 0;
                                const claimed = customer.claimedChallenges || [];
                                await updateDoc(doc(db, "customers", customer.id), {
                                  points: currentPoints + ch.pointsAward,
                                  claimedChallenges: [...claimed, ch.id]
                                });
                                setAlertConfig({
                                  isOpen: true,
                                  type: "success",
                                  title: t[lang].challengeClaimedAlertTitle,
                                  message: t[lang].challengeClaimedAlertMessage(ch.title, ch.pointsAward)
                                });
                              } catch (e) {
                                console.error("Error claiming points:", e);
                              }
                            }}
                            className={cn(
                              "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all",
                              canClaim 
                                ? "bg-slate-900 hover:bg-slate-850 text-white shadow-xl active:scale-95 cursor-pointer animate-soft-bounce" 
                                : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                          >
                            {canClaim ? t[lang].claimExtraRewardBtn : t[lang].locked}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Confirmation Bottom Modal Sheet */}
              <AnimatePresence>
                {confirmReward && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center">
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="bg-white w-full max-w-lg rounded-t-[3rem] border-t border-slate-200 shadow-2xl p-8 space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-black text-slate-800 tracking-tight">{t[lang].confirmRewardTitle}</h4>
                        <button type="button" 
                          onClick={() => setConfirmReward(null)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-450 rounded-full transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-x-4">
                        <div className="size-16 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm text-4xl shrink-0">
                          {confirmReward.emoji}
                        </div>
                        <div className="text-left">
                          <p className="text-[8px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mb-1">
                            {lang === "es" ? confirmReward.category : (confirmReward.category === "Bebidas" ? "Drinks" : confirmReward.category === "Lácteos" ? "Dairy" : confirmReward.category === "Otros" ? "Others" : confirmReward.category)}
                          </p>
                          <h5 className="font-black text-sm text-slate-800 tracking-tight">{confirmReward.name}</h5>
                          <p className="text-xs font-bold text-slate-400">{confirmReward.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{t[lang].pointsRequired}</p>
                          <p className="text-xl font-black text-rose-600 tracking-tight mt-1">{confirmReward.pointsCost} PTS</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                          <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{t[lang].pointsRemaining}</p>
                          <p className="text-xl font-black text-indigo-600 tracking-tight mt-1">{(customer.points || 0) - confirmReward.pointsCost} PTS</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button type="button" 
                          onClick={() => setConfirmReward(null)}
                          className="flex-1 py-4 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                        >
                          {t[lang].cancelBtn}
                        </button>
                        <button type="button" 
                          onClick={() => handleRedeemReward(confirmReward)}
                          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center justify-center gap-x-2"
                        >
                          <Gift size={14} />
                          <span>{t[lang].confirmRedeemBtn}</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "offers" && (
            <motion.div 
              key="offers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-x-3 mb-6">
                <button type="button" onClick={() => setActiveTab("home")} className="p-2 bg-white rounded-xl shadow-sm"><ArrowLeft size={18}/></button>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{lang === "es" ? "Mis Beneficios y Cupones" : "My Benefits & Coupons"}</h3>
              </div>

              {/* 1. SECCIÓN: CUPONES DE LA EMPRESA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag size={12} className="text-indigo-500" />
                    {lang === "es" ? "Cupones de la Empresa" : "Company Coupons"}
                  </h4>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black">
                    {coupons.length} {lang === "es" ? "ACTIVOS" : "ACTIVE"}
                  </span>
                </div>

                {coupons.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {coupons.map((offer, idx) => {
                      const isEligible = customer.points >= (LOYALTY_TIERS as any)[offer.minTier].min;
                      const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(offer.code);
                      
                      return (
                        <button type="button" 
                          key={offer.id || idx} 
                          disabled={!isEligible || isUsed}
                          onClick={() => {
                            if (activatedOffers.includes(offer.id)) {
                              setAlertConfig({
                                isOpen: true,
                                type: "info",
                                title: offer.title,
                                message: lang === "es" ? `Este beneficio ya está activo. Muestra el código "${offer.code}" en caja.` : `This benefit is already active. Present code "${offer.code}" at checkout.`
                              });
                            } else {
                              setAlertConfig({
                                isOpen: true,
                                type: "success",
                                title: offer.title,
                                message: lang === "es" ? `¡Oferta Disponible! Presenta el código "${offer.code}" en la caja del local para aplicar el beneficio: ${offer.desc}.` : `Offer Available! Present code "${offer.code}" at checkout to apply: ${offer.desc}.`,
                                onConfirm: () => setActivatedOffers(prev => [...prev, offer.id])
                              });
                            }
                          }}
                          className={cn(
                            "p-6 rounded-[2.5rem] border flex items-center gap-x-6 relative overflow-hidden text-left w-full group transition-all active:scale-[0.98]", 
                            offer.color || "bg-indigo-50 border-indigo-100 text-indigo-600",
                            activatedOffers.includes(offer.id) && "ring-4 ring-indigo-500/20 opacity-80",
                            (!isEligible || isUsed) && "grayscale opacity-40 bg-slate-100 border-slate-200 text-slate-400"
                          )}
                        >
                          <div className="text-4xl">{offer.img || "🎟️"}</div>
                          <div>
                            <h4 className="font-black text-sm">{offer.title}</h4>
                            <p className="text-xs font-bold opacity-80 mt-1">{offer.desc}</p>
                            {!isEligible ? (
                              <div className="mt-2 flex items-center gap-x-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                <Lock size={10} />
                                <span>{lang === "es" ? `Disponible en nivel ${offer.minTier}` : `Available at level ${offer.minTier}`}</span>
                              </div>
                            ) : isUsed ? (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500 flex-wrap">
                                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black tracking-normal flex items-center gap-1">
                                  ✓ {lang === "es" ? "YA UTILIZADO EN SU HISTORIAL" : "ALREADY USED IN YOUR HISTORY"}
                                </span>
                              </div>
                            ) : activatedOffers.includes(offer.id) ? (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-600 flex-wrap">
                                <span className="flex items-center gap-x-1">
                                  <Star size={10} className="fill-current" />
                                  <span>{lang === "es" ? `Cupón Activo: ${offer.code}` : `Active Coupon: ${offer.code}`}</span>
                                </span>
                                <span className="bg-indigo-100 text-indigo-850 px-1.5 py-0.2 rounded font-black tracking-normal">✓ {lang === "es" ? "LISTO PARA CAJA" : "READY FOR CHECKOUT"}</span>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-emerald-600 flex-wrap">
                                <span className="flex items-center gap-x-1">
                                  <Star size={10} />
                                  <span>{lang === "es" ? `¡Disponible para canje! Código: ${offer.code}` : `Available for redemption! Code: ${offer.code}`}</span>
                                </span>
                                <span className="bg-emerald-100 text-emerald-850 px-1.5 py-0.2 rounded font-black tracking-normal">✓ {lang === "es" ? "SISTEMA OK" : "SYSTEM OK"}</span>
                              </div>
                            )}
                          </div>
                          <div className="absolute top-0 right-0 p-4">
                            {!isEligible ? <Lock size={16} className="opacity-20" /> : <Tag size={16} className="opacity-20" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-[2rem] border border-dashed border-slate-200 text-center bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {lang === "es" ? "La empresa no cuenta con cupones promocionales configurados en este momento." : "The company does not have promotional coupons configured at this time."}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. SECCIÓN: CUPONES AUTOMÁTICOS POR PUNTOS */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                    {lang === "es" ? "Mis Cupones Automáticos por Puntos" : "My Automatic Coupons by Points"}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    {lang === "es" ? `Se activan inmediatamente según tus puntos acumulados por compra (${customer.points || 0} pts actuales)` : `Activated immediately based on your accumulated purchase points (${customer.points || 0} current pts)`}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {AUTOMATIC_POINT_COUPONS.map((offer) => {
                    const isEligible = (customer.points || 0) >= offer.requiredPoints;
                    const isUsed = customer?.usedCoupons && customer.usedCoupons.includes(offer.code);
                    
                    return (
                      <button type="button" 
                        key={offer.id} 
                        disabled={!isEligible || isUsed}
                        onClick={() => {
                          setAlertConfig({
                            isOpen: true,
                            type: "success",
                            title: offer.title,
                            message: lang === "es" ? `¡Puntos acumulados suficientes! Cupón Fidelidad activado automáticamente por tu historial de compras. Presenta el código "${offer.code}" en caja para aplicar un ${offer.desc}.` : `Sufficient accumulated points! Loyalty Coupon activated automatically based on your purchase history. Present code "${offer.code}" at checkout to apply: ${offer.desc}.`
                          });
                        }}
                        className={cn(
                          "p-6 rounded-[2.5rem] border flex items-center gap-x-6 relative overflow-hidden text-left w-full group transition-all active:scale-[0.98]", 
                          offer.color,
                          isEligible && !isUsed ? "ring-2 ring-emerald-500/20 shadow-sm" : "grayscale opacity-40 bg-slate-100 border-slate-200 text-slate-400"
                        )}
                      >
                        <div className="text-4xl">{offer.img}</div>
                        <div>
                          <h4 className="font-black text-sm">{offer.title}</h4>
                          <p className="text-xs font-bold opacity-80 mt-1">{offer.desc}</p>
                          {!isEligible ? (
                            <div className="mt-2 flex items-center gap-x-1.5 text-[8.5px] font-black uppercase tracking-widest text-slate-400">
                              <Lock size={10} />
                              <span>{lang === "es" ? `Requiere ${offer.requiredPoints} pts (te faltan ${offer.requiredPoints - (customer.points || 0)} pts)` : `Requires ${offer.requiredPoints} pts (${offer.requiredPoints - (customer.points || 0)} pts missing)`}</span>
                            </div>
                          ) : isUsed ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-widest text-slate-500 flex-wrap">
                              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black tracking-normal">{lang === "es" ? "✓ YA UTILIZADO EN SU HISTORIAL" : "✓ ALREADY USED IN YOUR HISTORY"}</span>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-x-1.5 text-[8.5px] font-black uppercase tracking-widest text-emerald-600">
                              <Star size={10} className="fill-current" />
                              <span>{lang === "es" ? `¡Activo por Puntos! Código: ${offer.code}` : `Active by Points! Code: ${offer.code}`}</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute top-0 right-0 p-4">
                          {!isEligible ? <Lock size={16} className="opacity-20" /> : <Star size={16} className="opacity-20 fill-current text-emerald-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "delivery" && (
            <motion.div 
              key="delivery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pb-32 pb-[calc(6rem+env(safe-area-inset-bottom))]"
            >
              <div className="bg-indigo-600 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 size-32 bg-white/10 blur-3xl rounded-full" />
                <h3 className="text-xl font-black">🚚 {lang === "es" ? "Seguimiento de Despachos" : "Delivery Tracking"}</h3>
                <p className="text-xs font-medium text-indigo-100 mt-2 leading-relaxed">
                  {lang === "es" 
                    ? "Monitorea tus encomiendas y despachos georreferenciados en tiempo real. Encuentra el estado de tu pedido (#), la comuna de entrega y el trayecto calculado."
                    : "Monitor your georeferenced shipments and deliveries in real time. Find the status of your order (#), the delivery commune, and the calculated route."}
                </p>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 md:p-6 overflow-hidden">
                <DeliveryMap portalCustomerId={customer?.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-between z-50 gap-1">
        <button type="button" 
          onClick={() => setActiveTab("home")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "home" ? "text-orange-600 scale-110 font-bold" : "text-slate-400")}
        >
          <Star size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">{t[lang].startNav}</span>
        </button>
        <button type="button" 
          onClick={() => setActiveTab("history")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "history" ? "text-orange-600 scale-110 font-bold" : "text-slate-400")}
        >
          <History size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">{t[lang].receiptsNav}</span>
        </button>
        <button type="button" 
          onClick={() => setActiveTab("wallet")}
          className={cn("size-10 rounded-xl flex items-center justify-center text-white -mt-8 shadow-md transition-all shrink-0", activeTab === "wallet" ? "bg-orange-600 scale-110" : "bg-slate-900 shadow-slate-200")}
        >
           <Wallet size={18} />
        </button>
        <button type="button" 
          onClick={() => setActiveTab("offers")}
          className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "offers" ? "text-orange-600 scale-110 font-bold" : "text-slate-400")}
        >
          <Tag size={18} />
          <span className="text-[7.5px] font-black uppercase tracking-wider">{t[lang].couponsNav}</span>
        </button>
        {settings.deliveryEnabled !== false && (
          <button type="button" 
            onClick={() => setActiveTab("delivery")}
            className={cn("flex-1 flex flex-col items-center space-y-1 transition-all", activeTab === "delivery" ? "text-orange-600 scale-110 font-bold" : "text-slate-400")}
          >
            <Truck size={18} />
            <span className="text-[7.5px] font-black uppercase tracking-wider">{t[lang].deliveryNav}</span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col items-center max-w-sm w-full"
            >
              <div className="relative mb-8">
                <div className="size-20 bg-orange-50 rounded-[2.5rem] flex items-center justify-center text-orange-600">
                  <ShoppingBag size={32} className="animate-soft-bounce" />
                </div>
                <div className="absolute inset-0 rounded-[2.5rem] border-4 border-orange-600 border-t-transparent animate-spin" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{lang === "es" ? "Preparando tu Pago" : "Preparing your Payment"}</h3>
              <p className="text-sm font-bold text-slate-400 mt-4 leading-relaxed">
                {lang === "es" 
                  ? "Estamos conectando con el portal de Flow para procesar tu pedido de forma segura."
                  : "We are connecting with Flow to process your order securely."}
              </p>
              
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-8 overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-orange-600 rounded-full"
                />
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4">{lang === "es" ? "Conexión Segura Encriptada" : "Secure Encrypted Connection"}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Temporary QR Sheet modal (Commit 6.B.1) */}
      <AnimatePresence>
        {isQRSheetOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[90vh] text-center"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">{lang === "es" ? "Mi código de socio" : "My Member Code"}</h3>
                <button type="button" onClick={() => setIsQRSheetOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-450">
                  <X size={18} />
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                {lang === "es" ? "Muéstralo en caja para sumar puntos e identificarte" : "Show it at checkout to earn points and identify yourself"}
              </p>

              <div className="my-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-lg max-w-[240px] mx-auto">
                <QRCodeCanvas 
                  value={secureToken || customer.taxId || customer.email} 
                  size={180}
                  level="H"
                  includeMargin={false}
                  className="w-full h-auto"
                />
              </div>

              {/* Countdown timer */}
              <div className="space-y-1.5 mb-5 px-4 text-left">
                <div className="flex justify-between items-center text-[9px] font-black tracking-wider text-slate-450">
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-indigo-500 animate-spin [animation-duration:8s]" />
                    {lang === "es" ? "CÓDIGO DINÁMICO SEGURO" : "SECURE DYNAMIC CODE"}
                  </span>
                  <span className="text-indigo-600 font-extrabold">
                    {lang === "es" ? `Se actualiza en ${timeLeft}s` : `Updates in ${timeLeft}s`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                  />
                </div>
              </div>

              {/* Numeric OTP pin fallback */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1 shadow-inner font-sans">
                <p className="text-[9px] font-black tracking-widest text-slate-450 uppercase">{lang === "es" ? "Token Numérico de Entrada" : "Numeric Input Token"}</p>
                <p className="font-mono text-2xl font-black text-indigo-600 tracking-[0.2em]">{securePin.slice(0,3)} {securePin.slice(3)}</p>
                <p className="text-[8px] font-bold text-slate-400 leading-normal">
                  {lang === "es" ? "Ingreso manual en caja si el lector óptico está apagado" : "Manual entry if optical scanner is off"}
                </p>
              </div>

              {/* Verified member pill */}
              <div className="mt-5 flex items-center justify-center gap-1.5 py-2 px-4 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100/50">
                <Crown size={12} fill="indigo" className="text-indigo-700" strokeWidth={0} />
                <span>{customer.name} · {customer.points || 0} pts</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-x-3">
                  <div className="size-10 bg-orange-600 rounded-xl flex items-center justify-center text-white">
                    <ShoppingCart size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">{t[lang].orderCartTitle}</h3>
                </div>
                <button type="button" onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mx-2 px-2 pb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-400 font-bold">{t[lang].cartEmptyText}</p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const product = products.find(p => p.id === item.id);
                    const moq = product?.wholesaleMinQty || 6;
                    const isWholesale = item.quantity >= moq && product?.wholesalePrice;
                    const itemPrice = isWholesale ? product.wholesalePrice : item.price;
                    
                    return (
                      <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-x-4">
                        <div className="size-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm overflow-hidden">
                          {product?.image ? (
                            <img src={product.image} alt={product.name || "Producto"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span aria-label={product?.name || "Producto"}>{product?.category === "Bebidas" ? "🥤" : product?.category === "Lácteos" ? "🧀" : "🍎"}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[11px] font-black text-slate-800 line-clamp-1">{item.name}</h4>
                          <p className="text-[9px] font-bold text-slate-500">{formatCurrency(itemPrice)} / un</p>
                          {isWholesale && (
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">{t[lang].wholesalePricingBadge}</span>
                          )}
                        </div>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                           <button type="button" 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="size-6 flex items-center justify-center text-slate-400 hover:text-rose-500"
                           >
                            <Minus size={10} />
                           </button>
                           <input 
                             type="number"
                             value={item.quantity}
                             onChange={(e) => {
                               const val = parseInt(e.target.value);
                               if (!isNaN(val)) {
                                 setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i).filter(i => i.quantity > 0));
                               }
                             }}
                             className="w-8 text-center bg-transparent border-none text-[10px] font-black text-slate-800 focus:ring-0 p-0"
                           />
                           <button type="button" 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="size-6 flex items-center justify-center text-slate-400 hover:text-indigo-600"
                           >
                            <Plus size={10} />
                           </button>
                        </div>
                        <button type="button" 
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  {/* Coupon section */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Tag size={12} className="text-indigo-600" />
                      <span>{t[lang].hasCouponLabel}</span>
                    </p>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100/50 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{appliedCoupon.img || "🎟️"}</span>
                          <div>
                            <p className="text-[10px] font-black text-indigo-950 uppercase">{appliedCoupon.code}</p>
                            <p className="text-[9px] text-indigo-600 font-bold">{appliedCoupon.desc}</p>
                          </div>
                        </div>
                        <button type="button" 
                          onClick={() => setAppliedCoupon(null)}
                          className="text-slate-400 hover:text-rose-500 font-black text-xs px-2 py-1"
                        >
                          {t[lang].removeLabel}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder={t[lang].couponPlaceholder}
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 uppercase"
                          />
                          <button type="button" 
                            onClick={() => handleApplyCoupon(couponInput)}
                            className="bg-indigo-600 text-white uppercase tracking-widest text-[9px] font-black px-4 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shrink-0"
                          >
                            {t[lang].applyLabel}
                          </button>
                        </div>
                        {couponError && (
                          <p className="text-[9px] text-rose-500 font-extrabold ml-1">{couponError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {appliedCoupon && (
                      <>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                          <span>{t[lang].subtotalLabel}</span>
                          <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-indigo-600">
                          <span className="flex items-center gap-1">🎟️ {t[lang].discountLabel} ({appliedCoupon.code})</span>
                          <span>-{formatCurrency(couponDiscount)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t[lang].estimatedTotalLabel}</span>
                      <span className="text-xl font-black text-slate-900">{formatCurrency(finalCartTotal)}</span>
                    </div>
                  </div>

                  <button type="button" 
                    onClick={() => {
                      setShowCart(false);
                      setAlertConfig({
                        isOpen: true,
                        type: "info",
                        title: t[lang].confirmOrderTitle,
                        message: t[lang].confirmOrderMsg(formatCurrency(finalCartTotal)),
                        onConfirm: handleCheckout
                      });
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-x-2"
                  >
                    <span>{t[lang].finishCheckoutBtn}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">{t[lang].notificationsTitle}</h3>
                <button type="button" onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {clientNotifications.map((notif: any) => (
                  <div key={notif.id} className={cn("p-4 rounded-2xl border transition-all hover:scale-[1.01] bg-white", notif.accent.split(" ")[2], notif.accent.split(" ")[1])}>
                    <div className={cn("flex items-center gap-x-2 mb-1", notif.accent.split(" ")[0])}>
                      {notif.icon === "puntos" && <Star size={12} className="fill-current" />}
                      {notif.icon === "meta" && <Gift size={12} />}
                      {notif.icon === "oferta" && <Tag size={12} />}
                      <span className="text-[8px] font-black uppercase tracking-widest">{notif.title}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{notif.message}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">{notif.timeText}</p>
                  </div>
                ))}
                {clientNotifications.length === 0 && (
                  <p className="text-center text-xs font-medium text-slate-400 py-6">{t[lang].notificationsEmpty}</p>
                )}
              </div>
              
              <button type="button" 
                onClick={() => setShowNotifications(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
              >
                {t[lang].closeBtn}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 105, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 105, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] border border-slate-100"
            >
              {/* Header section with brand accent */}
              <div className="bg-slate-900 text-white p-6 pb-8 text-center relative shrink-0">
                <button type="button" 
                  onClick={() => setSelectedReceipt(null)} 
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/80 transition-colors"
                >
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
                <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Receipt size={24} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-black tracking-tight">{settings.businessName || (lang === "es" ? "Nuestra Tienda" : "Our Store")}</h3>
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">{t[lang].receiptTitle}</p>
              </div>

              {/* Scrollable Receipt Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-600 font-bold">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].docLabel}</p>
                    <p className="text-slate-800">
                      {selectedReceipt.documentType === "Factura" || selectedReceipt.documentType === "Factura Electrónica" 
                        ? (lang === "es" ? "Factura Electrónica" : "Electronic Invoice") 
                        : (lang === "es" ? "Boleta Electrónica" : "Electronic Receipt")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].orderCodeLabel}</p>
                    <p className="font-mono text-slate-800 truncate max-w-[130px]" title={selectedReceipt.orderId}>
                      #{selectedReceipt.orderId.substring(0, 10).toUpperCase()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].dateTimeLabel}</p>
                    <p className="text-slate-800">
                      {toDate(selectedReceipt.timestamp).toLocaleString(lang === "es" ? 'es-CL' : 'en-US')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].attendedByLabel}</p>
                    <p className="text-slate-800 truncate">
                      {selectedReceipt.type === "app_purchase" 
                        ? t[lang].attendedAutoApp 
                        : (selectedReceipt.userName ? t[lang].attendedCashier(selectedReceipt.userName) : t[lang].attendedCashierDefault)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].purchaseTypeLabel}</p>
                    <p className="text-slate-800">
                      {selectedReceipt.type === "app_purchase" ? t[lang].purchaseTypeApp : t[lang].purchaseTypePos}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{t[lang].deliveryMethodLabel}</p>
                    <p className="text-slate-800">
                      {selectedReceipt.type === "app_purchase" ? t[lang].deliveryMethodApp : t[lang].deliveryMethodPos}
                    </p>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t[lang].productDetailHeader}</p>
                  
                  <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    {selectedReceipt.items.map((item: any) => {
                      const qty = item.quantity || 1;
                      const unitPrice = item.amount / qty;
                      return (
                        <div key={item.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                          <div className="space-y-1 max-w-[65%]">
                            <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              {t[lang].qtyUnitsTimes(qty, qty > 1 ? t[lang].pluralSuffix : t[lang].singularSuffix, formatCurrency(unitPrice))}
                            </p>
                            {(() => {
                              const sourceBranch = item.branchId && item.branchId !== DEFAULT_BRANCH_ID
                                ? activeBranches.find((b: any) => b.id === item.branchId)
                                : null;
                              return sourceBranch && (
                                <p
                                  className="text-xs text-zinc-400 mt-1 flex items-center gap-x-1"
                                  aria-label={`Despachado desde sucursal ${sourceBranch.name}`}
                                >
                                  <Truck size={12} aria-hidden="true" />
                                  <span>{t[lang].shippedFromBranch(sourceBranch.name)}</span>
                                </p>
                              );
                            })()}
                          </div>
                          <p className="font-black text-slate-900">{formatCurrency(item.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dashed line transition */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200" />
                  </div>
                  <div className="absolute left-[-2rem] top-1/2 -translate-y-1/2 size-4 bg-slate-900/60 rounded-full" />
                  <div className="absolute right-[-2rem] top-1/2 -translate-y-1/2 size-4 bg-slate-900/60 rounded-full" />
                </div>

                {/* Financial breakdown & summary */}
                <div className="space-y-2.5 px-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>{t[lang].receiptSubtotal}</span>
                    <span className="text-slate-800">
                      {formatCurrency(
                        selectedReceipt.items.reduce((sum: number, it: any) => sum + it.amount, 0)
                      )}
                    </span>
                  </div>
                  
                  {selectedReceipt.couponCode && (
                    <div className="flex justify-between font-bold text-amber-600">
                      <span className="flex items-center gap-1">🏷️ {t[lang].discountLabel} ({selectedReceipt.couponCode}):</span>
                      <span>-{formatCurrency(selectedReceipt.discountApplied)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-slate-100 text-slate-900">
                    <span>{t[lang].receiptTotalPaid}</span>
                    <span className="text-slate-950 font-mono text-base">{formatCurrency(selectedReceipt.finalOrderTotal)}</span>
                  </div>
                </div>

                {/* Fidelidad / Puntos rewarded section */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-x-2.5">
                    <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <Star size={16} className="fill-current text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-black text-emerald-900">{t[lang].fidelityPointsReward}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">{t[lang].fidelityPointsMessage}</p>
                    </div>
                  </div>
                  <p className="text-base font-black font-mono text-emerald-600">
                    +{Math.floor(selectedReceipt.finalOrderTotal / 1000)} PTS
                  </p>
                </div>

                {/* Proof of delivery Signature */}
                {selectedReceiptShipment && selectedReceiptShipment.status === "delivered" && selectedReceiptShipment.customerSignature && (
                  <div className="p-4 rounded-[1.8rem] bg-indigo-50/45 border border-indigo-100/60 flex flex-col space-y-2 text-xs text-slate-800 text-left">
                    <p className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">{t[lang].deliveryProofTitle}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{t[lang].receivedByLabel}</p>
                        <p className="font-extrabold text-slate-800 mt-0.5">{selectedReceiptShipment.customerSignedName || (lang === "es" ? "Cliente" : "Customer")}</p>
                      </div>
                      <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded-full text-center">
                        {t[lang].deliveredBadge}
                      </div>
                    </div>
                    <div className="h-px bg-indigo-150 my-1" />
                    <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-150">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 pointer-events-none self-start">{t[lang].digitalSignatureTitle}</p>
                      <img 
                        src={selectedReceiptShipment.customerSignature} 
                        alt={t[lang].digitalSignatureAlt} 
                        className="max-h-20 max-w-full object-contain filter contrast-125 select-none" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* Real-time details if digital wallet or specific notes */}
                {selectedReceipt.note && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-[11px] font-semibold text-indigo-700 leading-relaxed text-center">
                    💡 {selectedReceipt.note}
                  </div>
                )}

                {/* Chilean SII DTE Timbre Electrónico or basic Receipt QR */}
                {selectedReceipt.isMock ? (
                  <div className="p-4 bg-amber-50/50 text-amber-800 rounded-2.5xl border-2 border-amber-300 border-dashed text-center font-mono space-y-1.5 shadow-inner">
                    <p className="text-[10px] font-black tracking-widest text-amber-900 leading-normal">
                      {t[lang].internalReceiptWarning}
                    </p>
                    <div className="py-2 flex justify-center">
                      <QRCodeCanvas 
                        value={selectedReceipt.orderId || "MOCK_ORDER"} 
                        size={100}
                        level="M"
                        className="opacity-75 grayscale shrink-0 border-4 border-white rounded-lg p-0.5"
                      />
                    </div>
                  </div>
                ) : selectedReceipt.documentType?.includes("Boleta") || selectedReceipt.folio ? (
                  <div className="p-4 bg-red-50/50 text-red-700 rounded-2.5xl border-2 border-red-200 border-dashed text-center font-mono space-y-1.5 shadow-inner">
                    <p className="text-[9px] font-black tracking-widest text-red-650">{t[lang].siiStampHeader}</p>
                    <p className="text-[7.5px] font-bold text-red-500 uppercase tracking-widest leading-none">
                      {t[lang].siiStampDesc(String(selectedReceipt.folio || Math.floor(Math.random() * 5000) + 151240))}
                    </p>
                    <div className="py-2 flex justify-center">
                      <QRCodeCanvas 
                        value={selectedReceipt.tedXml || `<TED><DD><F>${selectedReceipt.folio || '151240'}</F></DD></TED>`} 
                        size={110}
                        level="L"
                        className="opacity-90 grayscale shrink-0 border-4 border-white rounded-lg p-0.5"
                      />
                    </div>
                    <p className="text-[6.5px] tracking-tight text-slate-400 select-all font-sans leading-tight break-all max-h-[30px] overflow-hidden">
                      {selectedReceipt.tedXml || t[lang].siiPendingWarning}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2 py-2">
                    <div className="p-2 border border-slate-100 bg-white rounded-xl shadow-sm">
                      <QRCodeCanvas 
                        value={selectedReceipt.orderId} 
                        size={80}
                        level="M"
                        className="size-16 opacity-80"
                      />
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t[lang].verificationCodeLabel}</span>
                  </div>
                )}

              </div>

              {/* Action buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setClaimOrderId(selectedReceipt.orderId);
                    setClaimCustomerTaxId(customer?.taxId || "");
                    setTaxIdError("");
                    setClaimReason(lang === "es" ? "Llegó roto" : "Arrived broken");
                    setClaimDescription("");
                    setClaimPhoto("");
                    setShowClaimModal(true);
                    setSelectedReceipt(null);
                  }}
                  className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white transition-all rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 dark:shadow-none hover:translate-y-[-1px] active:translate-y-0"
                >
                  <AlertCircle size={14} />
                  {lang === "es" ? "Iniciar Reclamo / Soporte" : "Start Claim / Support"}
                </button>
                <div className="flex gap-x-3 w-full">
                  <button type="button"
                    onClick={() => {
                      // Create a style-trimmed receipt plain print format
                      const itemLines = selectedReceipt.items.map((item: any) => 
                        `${item.productName} [x${item.quantity}] \t\t ${formatCurrency(item.amount)}`
                      ).join('\n');
                      
                      const docTypeLabel = selectedReceipt.documentType === "Factura" || selectedReceipt.documentType === "Factura Electrónica" 
                        ? (lang === "es" ? "FACTURA ELECTRÓNICA" : "ELECTRONIC INVOICE") 
                        : (lang === "es" ? "BOLETA ELECTRÓNICA" : "ELECTRONIC RECEIPT");
                      
                      const deliveryMethodText = selectedReceipt.type === "app_purchase" 
                        ? (lang === "es" ? "Retiro en Local" : "In-Store Pickup") 
                        : (lang === "es" ? "Entrega Presencial en Caja" : "Hand Delivery at Checkout");
                      
                      const purchaseTypeText = selectedReceipt.type === "app_purchase" 
                        ? (lang === "es" ? "Pedido Online (App)" : "Online Order (App)") 
                        : (lang === "es" ? "Compra Presencial (POS)" : "In-Store Purchase (POS)");
                      
                      const attendedByText = selectedReceipt.type === "app_purchase" 
                        ? (lang === "es" ? "Auto-Atención App" : "App Self-Service") 
                        : (selectedReceipt.userName 
                            ? `${lang === "es" ? "Cajero" : "Cashier"}: ${selectedReceipt.userName}` 
                            : (lang === "es" ? "Cajero de Turno" : "Cashier on Duty"));

                      const receiptText = `
----------------------------------------
   ${(settings.businessName || (lang === "es" ? "NUESTRA TIENDA" : "OUR STORE")).toUpperCase()}
----------------------------------------
${lang === "es" ? "Documento:" : "Document:"}     ${docTypeLabel}
${lang === "es" ? "Orden ID:" : "Order ID:"}      #${selectedReceipt.orderId}
${lang === "es" ? "Fecha:" : "Date:"}         ${toDate(selectedReceipt.timestamp).toLocaleString(lang === "es" ? 'es-CL' : 'en-US')}
${lang === "es" ? "Cliente:" : "Customer:"}       ${selectedReceipt.customerName}
${lang === "es" ? "RUT Cliente:" : "Customer RUT:"}   ${selectedReceipt.customerTaxId || "N/A"}
----------------------------------------
${lang === "es" ? "Canal Compra:" : "Purchase Ch:"}  ${purchaseTypeText}
${lang === "es" ? "Entrega:" : "Delivery:"}       ${deliveryMethodText}
${lang === "es" ? "Atendido Por:" : "Attended By:"}  ${attendedByText}
----------------------------------------
${lang === "es" ? "DETALLE DE PRODUCTOS:" : "PRODUCT DETAILS:"}
${itemLines}
----------------------------------------
Subtotal:      ${formatCurrency(selectedReceipt.items.reduce((sum: number, it: any) => sum + it.amount, 0))}
${lang === "es" ? "Descuento" : "Discount"}:     ${selectedReceipt.couponCode ? `(${selectedReceipt.couponCode}) -${formatCurrency(selectedReceipt.discountApplied)}` : 'N/A'}
TOTAL NETO:    ${formatCurrency(selectedReceipt.finalOrderTotal)}
----------------------------------------
${lang === "es" ? "Beneficio:" : "Benefit:"}     +${Math.floor(selectedReceipt.finalOrderTotal / 1000)} ${lang === "es" ? "Puntos de Fidelidad" : "Fidelity Points"}
----------------------------------------
      ${lang === "es" ? "¡Gracias por tu preferencia!" : "Thank you for shopping with us!"}
----------------------------------------
                      `;
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(`<pre style="font-family: monospace; font-size: 14px; padding: 20px;">${receiptText}</pre>`);
                        win.document.close();
                        win.print();
                      }
                    }}
                    className="flex-1 py-3 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Printer size={14} />
                    {t[lang].printBtn}
                  </button>
                  <button type="button"
                    onClick={() => setSelectedReceipt(null)}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white transition-colors rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    {t[lang].closeBtn}
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Submission Modal Overlay (Paso 3.1) */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: 150, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 150, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
            >
              <div className="bg-rose-600 text-white p-6 text-center relative shrink-0">
                <button type="button" 
                  onClick={() => setShowClaimModal(false)} 
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/80 transition-colors"
                >
                  <ArrowLeft size={18} className="-rotate-90" />
                </button>
                <div className="size-12 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <AlertCircle size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight">{lang === "es" ? "Iniciar Reclamo / Soporte" : "File Support Ticket / Claim"}</h3>
                <p className="text-[10px] font-bold opacity-75 uppercase tracking-widest mt-1">
                  {claimOrderId ? `${lang === "es" ? "Boleta" : "Receipt"} #${claimOrderId.substring(0, 10).toUpperCase()}` : (lang === "es" ? "Reclamo General Chile" : "General Claim Ticket")}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                {/* Form fields */}
                {/* RUT del Cliente */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest ml-1">
                    {lang === "es" ? "RUT del Cliente" : "Customer RUT"}
                  </label>
                  <input
                    type="text"
                    value={claimCustomerTaxId}
                    onChange={(e) => {
                      const formatted = formatRUT(e.target.value);
                      setClaimCustomerTaxId(formatted);
                      if (formatted && !validateChileanRUT(formatted)) {
                        setTaxIdError(lang === "es" ? "❌ RUT inválido (Dígito verificador incorrecto)" : "❌ Invalid RUT (Bad check-digit)");
                      } else {
                        setTaxIdError("");
                      }
                    }}
                    placeholder="12.345.678-9"
                    className="w-full h-12 bg-white border border-slate-250 rounded-xl px-4 text-xs font-bold focus:outline-hidden focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                  />
                  {taxIdError && (
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1 mt-1">
                      {taxIdError}
                    </p>
                  )}
                </div>

                {/* Número de Boleta */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest ml-1">
                    {lang === "es" ? "Número de Boleta de la Compra" : "Purchase Receipt Number"}
                  </label>
                  <input
                    type="text"
                    value={claimOrderId}
                    onChange={(e) => setClaimOrderId(e.target.value)}
                    placeholder="e.g. pos_171457…"
                    className="w-full h-12 bg-white border border-slate-250 rounded-xl px-4 text-xs font-bold focus:outline-hidden focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {lang === "es" ? "Motivo del Inconveniente" : "Reason For Ticket"}
                  </label>
                  <select 
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm appearance-none"
                  >
                    <option value="Llegó roto">{lang === "es" ? "Llegó roto / dañado" : "Arrived broken / damaged"}</option>
                    <option value="Faltó un producto">{lang === "es" ? "Faltó un producto en el envío" : "Missing item in delivery"}</option>
                    <option value="Producto incorrecto">{lang === "es" ? "Recibí un producto equivocado" : "Received wrong item"}</option>
                    <option value="Defecto de fábrica">{lang === "es" ? "Defecto de calidad/fábrica" : "Quality/Factory defect"}</option>
                    <option value="Otro motivo">{lang === "es" ? "Otro inconveniente" : "Other issue"}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {lang === "es" ? "Detalle del Problema" : "Problem Details"}
                  </label>
                  <textarea 
                    placeholder={lang === "es" ? "Explica detalladamente qué sucedió con tu producto o pedido…" : "Please describe in detail what happened to your product or order…"}
                    rows={4}
                    value={claimDescription}
                    onChange={(e) => setClaimDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm placeholder-slate-400 leading-normal resize-none"
                    maxLength={500}
                    required
                  />
                  <div className="flex justify-end text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    {claimDescription.length}/500 caracteres
                  </div>
                </div>

                {/* Evidence Photo upload */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {lang === "es" ? "Foto de Evidencia (Físico/Empaque)" : "Evidence Photo (Physical Receipt/Package)"}
                  </label>
                  
                  <div className="flex items-center gap-x-4">
                    <input 
                      type="file" 
                      id="claim-photo-input"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setClaimPhoto(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("claim-photo-input");
                        if (el) el.click();
                      }}
                      className="size-16 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-rose-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-rose-500 transition-all active:scale-95 shadow-sm"
                    >
                      <Camera size={20} />
                      <span className="text-[8px] font-black mt-1 uppercase tracking-wider">{lang === "es" ? "CÁMARA" : "CAMERA"}</span>
                    </button>

                    {claimPhoto ? (
                      <div className="relative size-16 rounded-2xl overflow-hidden border border-slate-150 shadow-sm shrink-0 bg-slate-100">
                        <img src={claimPhoto} alt="Previsualización" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setClaimPhoto("")}
                          className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:scale-105 transition-transform"
                          title={lang === "es" ? "Eliminar foto" : "Delete photo"}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[9px] font-bold text-slate-400 leading-normal max-w-[180px]">
                        {lang === "es" 
                          ? "Toma una fotografía clara del producto roto, vencido o del empaque completo."
                          : "Take a clear picture of the damaged/expired product or of the package."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors rounded-xl font-bold text-[10px]"
                >
                  {lang === "es" ? "Cancelar" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingClaim || !claimDescription.trim() || !claimOrderId.trim() || !claimCustomerTaxId.trim() || !!taxIdError}
                  onClick={async () => {
                    if (!claimDescription.trim() || !claimOrderId.trim() || !claimCustomerTaxId.trim() || !!taxIdError) return;
                    
                    if (!validateChileanRUT(claimCustomerTaxId)) {
                      setTaxIdError(lang === "es" ? "❌ RUT inválido" : "❌ Invalid RUT");
                      return;
                    }

                    setIsSubmittingClaim(true);
                    try {
                      await addDoc(collection(db, "claims"), {
                        customerId: customer.id,
                        customerName: customer.name || "Cliente",
                        customerRUT: claimCustomerTaxId.trim(),
                        orderId: claimOrderId.trim(),
                        reason: claimReason,
                        description: claimDescription.trim(),
                        photo: claimPhoto || null,
                        status: "pending",
                        resolutionNote: "",
                        timestamp: serverTimestamp()
                      });

                      setAlertConfig({
                        isOpen: true,
                        type: "success",
                        title: lang === "es" ? "¡Reclamo Registrado!" : "Claim Registered!",
                        message: lang === "es" 
                          ? "Tu caso fue subido con éxito y enviado a bodega. Estaremos evaluando tu caso de inmediato."
                          : "Your claims ticket was successfully saved and routed to fulfillment. We will review your case immediately."
                      });
                      setShowClaimModal(false);
                      setActiveTab("history");
                      setActiveHistorySubTab("claims");
                    } catch (err: any) {
                      console.error("Error submitting claim: ", err);
                      setAlertConfig({
                        isOpen: true,
                        type: "error",
                        title: lang === "es" ? "Error de Envío" : "Submission Error",
                        message: lang === "es" 
                          ? "No se pudo registrar el reclamo. Verifica tu conexión a internet e intenta nuevamente."
                          : "Could not submit your claim ticket. Please check your network connection and try again."
                      });
                    } finally {
                      setIsSubmittingClaim(false);
                    }
                  }}
                  className={cn(
                    "flex-1 py-3.5 text-white transition-all rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 shadow-md",
                    (claimDescription.trim() && claimOrderId.trim() && claimCustomerTaxId.trim() && !taxIdError) 
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100 dark:shadow-none"
                      : "bg-slate-300 shadow-none cursor-not-allowed"
                  )}
                >
                  {isSubmittingClaim ? (
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{lang === "es" ? "Enviar Caso" : "Submit Case"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernAlert 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.title === "Confirmar Pedido" ? "Pagar con Flow" : "Aceptar"}
      />
    </div>
  );
}

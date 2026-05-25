importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAYdmybHCnvXe27-tpzQ9FV9mx65CoK_FE",
  authDomain: "workspace-mcp-493503.firebaseapp.com",
  projectId: "workspace-mcp-493503",
  storageBucket: "workspace-mcp-493503.firebasestorage.app",
  messagingSenderId: "452061924377",
  appId: "1:452061924377:web:6d737aabf7f5468a416e88"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  if (!payload.notification) return;

  const notificationTitle = payload.notification.title || "StockFlow Pro";
  const notificationOptions = {
    body: payload.notification.body || "Cambio en el estado de tu pedido.",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

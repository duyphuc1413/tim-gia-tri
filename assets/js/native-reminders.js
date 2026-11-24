(function () {
  "use strict";

  var NOTIF_ID = 202601;

  function isNativeCapacitor() {
    return !!(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );
  }

  function getLocalNotificationsPlugin() {
    if (!window.Capacitor || !window.Capacitor.Plugins) return null;
    return window.Capacitor.Plugins.LocalNotifications || null;
  }

  /**
   * Đăng ký Service Worker cho PWA (tự bỏ qua nếu đang chạy trong file:// hoặc Capacitor native).
   */
  function registerPwa() {
    if (isNativeCapacitor()) return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  /**
   * Đặt lịch thông báo lặp lại hằng ngày trên ứng dụng iOS / Android (Capacitor LocalNotifications).
   */
  function scheduleNativeDaily(hour, minute, title, body) {
    var plugin = getLocalNotificationsPlugin();
    if (!plugin) {
      return Promise.resolve({ supported: false, mode: "web" });
    }

    return plugin.requestPermissions().then(function (perm) {
      if (!perm || perm.display !== "granted") {
        throw new Error("Bạn chưa cấp quyền thông báo cho ứng dụng.");
      }
      return plugin.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(function () {});
    }).then(function () {
      return plugin.schedule({
        notifications: [
          {
            id: NOTIF_ID,
            title: title || "Tìm Giá Trị · Câu hỏi hôm nay",
            body: body || "Dành 1 phút soi chiếu để giữ chuỗi sống đúng giá trị cốt lõi của bạn.",
            schedule: {
              on: { hour: Number(hour), minute: Number(minute) },
              repeats: true,
              allowWhileIdle: true
            }
          }
        ]
      });
    }).then(function () {
      return { supported: true, mode: "native" };
    });
  }

  function cancelNativeDaily() {
    var plugin = getLocalNotificationsPlugin();
    if (!plugin) return Promise.resolve();
    return plugin.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(function () {});
  }

  registerPwa();

  window.TGTNativeReminders = {
    isNative: isNativeCapacitor,
    scheduleNativeDaily: scheduleNativeDaily,
    cancelNativeDaily: cancelNativeDaily
  };
})();

(function () {
  "use strict";

  var cfg = window.TGT_CONFIG || {};
  var Billing = window.TimGiaTriBilling;
  var configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && typeof window.supabase.createClient === "function");

  var client = configured
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  var state = {
    configured: configured,
    user: null,
    profile: null,
    entitlement: Billing ? Billing.computeEntitlement(null) : { status: "anonymous", isPro: false, daysLeft: 0, expiresAt: null, label: "" }
  };

  var listeners = [];
  var readyResolve = null;
  var readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
  var isReady = false;

  function emit() {
    updateNavBadge();
    listeners.forEach(function (fn) {
      try { fn(getState()); } catch (e) {}
    });
  }

  function getState() {
    return {
      configured: state.configured,
      user: state.user,
      profile: state.profile,
      entitlement: state.entitlement
    };
  }

  function updateNavBadge() {
    var link = document.getElementById("accountNavLink");
    if (!link) return;
    if (!state.configured) {
      link.textContent = "Gói Pro";
      link.removeAttribute("data-status");
      return;
    }
    if (!state.user) {
      link.textContent = "Đăng nhập · Pro";
      link.removeAttribute("data-status");
      return;
    }
    var ent = state.entitlement;
    if (ent.status === "paid") {
      link.textContent = "Tài khoản · Pro";
      link.setAttribute("data-status", "pro");
    } else if (ent.status === "trial") {
      link.textContent = "Dùng thử (" + ent.daysLeft + " ngày)";
      link.setAttribute("data-status", "trial");
    } else {
      link.textContent = "Tài khoản";
      link.setAttribute("data-status", "free");
    }
  }

  function refreshProfile() {
    if (!client || !state.user) {
      state.profile = null;
      state.entitlement = Billing ? Billing.computeEntitlement(null) : state.entitlement;
      emit();
      return Promise.resolve(null);
    }
    return client
      .from("profiles")
      .select("id, email, phone, display_name, trial_ends_at, paid_until, reminder_opt_in, reminder_email, created_at")
      .eq("id", state.user.id)
      .maybeSingle()
      .then(function (res) {
        if (!res.error && res.data) {
          state.profile = res.data;
          state.entitlement = Billing ? Billing.computeEntitlement(res.data) : state.entitlement;
        }
        emit();
        return state.profile;
      });
  }

  function syncSession(session) {
    state.user = session && session.user ? session.user : null;
    if (!state.user) {
      state.profile = null;
      state.entitlement = Billing ? Billing.computeEntitlement(null) : state.entitlement;
      emit();
      return Promise.resolve();
    }
    return refreshProfile();
  }

  function init() {
    updateNavBadge();
    if (!client) {
      isReady = true;
      readyResolve(getState());
      return;
    }
    client.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      return syncSession(session);
    }).catch(function () {
      return syncSession(null);
    }).finally(function () {
      if (!isReady) {
        isReady = true;
        readyResolve(getState());
      }
    });

    client.auth.onAuthStateChange(function (_event, session) {
      syncSession(session);
    });
  }

  function requireClient() {
    if (!client) {
      return Promise.reject(new Error("Hệ thống tài khoản chưa được kết nối với máy chủ Supabase."));
    }
    return Promise.resolve(client);
  }

  function getRedirectUrl() {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      return new URL("account.html", window.location.href).toString();
    }
    return (cfg.siteUrl || "").replace(/\/+$/, "") + "/account.html";
  }

  function signInWithEmail(email, password) {
    return requireClient().then(function (sb) {
      return sb.auth.signInWithPassword({ email: email.trim(), password: password });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signUpWithEmail(email, password, displayName) {
    return requireClient().then(function (sb) {
      return sb.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: getRedirectUrl(),
          data: { full_name: (displayName || "").trim() }
        }
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function resetPassword(email) {
    return requireClient().then(function (sb) {
      return sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getRedirectUrl()
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return true;
    });
  }

  function updatePassword(newPassword) {
    return requireClient().then(function (sb) {
      return sb.auth.updateUser({ password: newPassword });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signInWithGoogle() {
    return requireClient().then(function (sb) {
      return sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getRedirectUrl() }
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function sendPhoneOtp(phoneInput) {
    var phone = Billing ? Billing.normalizeVnPhoneClient(phoneInput) : null;
    if (!phone) {
      return Promise.reject(new Error("Số điện thoại Việt Nam chưa đúng (ví dụ: 0901234567)."));
    }
    return requireClient().then(function (sb) {
      return sb.auth.signInWithOtp({ phone: phone });
    }).then(function (res) {
      if (res.error) throw res.error;
      return phone;
    });
  }

  function verifyPhoneOtp(phoneInput, token) {
    var phone = Billing ? Billing.normalizeVnPhoneClient(phoneInput) : null;
    if (!phone) {
      return Promise.reject(new Error("Số điện thoại không hợp lệ."));
    }
    return requireClient().then(function (sb) {
      return sb.auth.verifyOtp({
        phone: phone,
        token: String(token || "").trim(),
        type: "sms"
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signOut() {
    return requireClient().then(function (sb) {
      return sb.auth.signOut();
    }).then(function (res) {
      if (res.error) throw res.error;
      return true;
    });
  }

  function updateProfile(patch) {
    return requireClient().then(function (sb) {
      if (!state.user) throw new Error("Bạn chưa đăng nhập.");
      var safe = {};
      if (typeof patch.display_name === "string") safe.display_name = patch.display_name.trim().slice(0, 80);
      if (typeof patch.reminder_opt_in === "boolean") safe.reminder_opt_in = patch.reminder_opt_in;
      if (typeof patch.reminder_email === "string") safe.reminder_email = patch.reminder_email.trim().slice(0, 120) || null;
      return sb.from("profiles").update(safe).eq("id", state.user.id);
    }).then(function (res) {
      if (res.error) throw res.error;
      return refreshProfile();
    });
  }

  function invokeEdge(fnName, body) {
    return requireClient().then(function (sb) {
      return sb.auth.getSession().then(function (sRes) {
        var token = sRes && sRes.data && sRes.data.session ? sRes.data.session.access_token : "";
        if (!token) throw new Error("Bạn cần đăng nhập trước.");
        var url = cfg.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/" + fnName;
        return fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
            apikey: cfg.supabaseAnonKey
          },
          body: JSON.stringify(body || {})
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            if (!r.ok) throw new Error(data.error || "Có lỗi xảy ra từ máy chủ.");
            return data;
          });
        });
      });
    });
  }

  function createPayment(plan) {
    return invokeEdge("create-payment", { plan: plan });
  }

  function deleteAccount() {
    return invokeEdge("delete-account", {}).then(function (data) {
      if (client) client.auth.signOut().catch(function () {});
      return data;
    });
  }

  function listOrders() {
    return requireClient().then(function (sb) {
      return sb
        .from("orders")
        .select("order_code, plan, amount, status, checkout_url, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(20);
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function listJourneys() {
    return requireClient().then(function (sb) {
      return sb
        .from("journeys")
        .select("id, title, data, created_at, updated_at, completed_at")
        .order("updated_at", { ascending: false })
        .limit(30);
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function saveJourneyCloud(cloudId, title, data, completed) {
    return requireClient().then(function (sb) {
      if (!state.user) throw new Error("Bạn chưa đăng nhập.");
      var payload = {
        user_id: state.user.id,
        title: title || "Hành trình tìm giá trị",
        data: data,
        completed_at: completed ? new Date().toISOString() : null
      };
      if (cloudId) {
        return sb.from("journeys").update(payload).eq("id", cloudId).select("id, updated_at").single();
      }
      return sb.from("journeys").insert(payload).select("id, updated_at").single();
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function deleteJourneyCloud(cloudId) {
    return requireClient().then(function (sb) {
      return sb.from("journeys").delete().eq("id", cloudId);
    }).then(function (res) {
      if (res.error) throw res.error;
      return true;
    });
  }

  window.TGTAccount = {
    isConfigured: function () { return state.configured; },
    ready: function () { return readyPromise; },
    getState: getState,
    refreshProfile: refreshProfile,
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    signInWithEmail: signInWithEmail,
    signUpWithEmail: signUpWithEmail,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    signInWithGoogle: signInWithGoogle,
    sendPhoneOtp: sendPhoneOtp,
    verifyPhoneOtp: verifyPhoneOtp,
    signOut: signOut,
    updateProfile: updateProfile,
    createPayment: createPayment,
    deleteAccount: deleteAccount,
    listOrders: listOrders,
    listJourneys: listJourneys,
    saveJourneyCloud: saveJourneyCloud,
    deleteJourneyCloud: deleteJourneyCloud
  };

  init();
})();

(function () {
  "use strict";

  var DEFAULT_INDUSTRIES = Object.freeze([
    {
      slug: "predilecta-alimentos",
      name: "Predilecta Alimentos",
      shortName: "Predilecta",
      monogram: "PA",
      logo: "assets/brands/predilecta.png",
    },
    {
      slug: "precioso-alimentos",
      name: "Precioso Alimentos",
      shortName: "Precioso",
      monogram: "PR",
      logo: "assets/brands/precioso.avif",
    },
    {
      slug: "vale-fertil",
      name: "Vale Fértil",
      shortName: "Vale Fértil",
      monogram: "VF",
      logo: "assets/brands/vale-fertil.avif",
    },
    {
      slug: "bendo-alimentos",
      name: "Bendo Alimentos",
      shortName: "Bendo",
      monogram: "BA",
      logo: null,
    },
    {
      slug: "ruppers",
      name: "Ruppers",
      shortName: "Ruppers",
      monogram: "RU",
      logo: "assets/brands/ruppers.avif",
    },
    {
      slug: "dacolonia-alimentos",
      name: "DaColônia Alimentos",
      shortName: "DaColônia",
      monogram: "DC",
      logo: "assets/brands/dacolonia.avif",
    },
    {
      slug: "tourinho-alimentos",
      name: "Tourinho Alimentos",
      shortName: "Tourinho",
      monogram: "TA",
      logo: "assets/brands/tourinho.avif",
    },
  ]);

  var state = {
    products: [],
    adminSearch: "",
    adminFilter: "all",
    editingId: null,
    pendingImage: null,
    removeId: null,
    defaultIndustry: "",
    industries: [],
    googleAccessToken: "",
    googleTokenExpiresAt: 0,
    googleAccountEmail: "",
    masterAuthenticated: sessionStorage.getItem("fe-master-session") === "active",
    accessRole: sessionStorage.getItem("fe-access-role") || "master",
  };

  var MASTER_ACCOUNT_KEY = "fe-catalogo-master-account-v1";
  var INDUSTRIES_KEY = "fe-catalogo-industries-v1";
  var GOOGLE_CLIENT_ID =
    "1084907924579-93i3dfhtnvckmhrh4mc7n2rtl4rmet5s.apps.googleusercontent.com";
  var GOOGLE_ADMIN_EMAIL = "marketingrupofe@gmail.com";
  var GOOGLE_EDITOR_EMAIL = "marcio@ferepresentacoes.com";
  var GOOGLE_DRIVE_ROOT_FOLDER_ID = "161pUuGFex-G58qqtJbNGUy2FjpwHlH77";
  var GOOGLE_DRIVE_SCOPE =
    "openid email https://www.googleapis.com/auth/drive";

  function cloneDefaultIndustries() {
    return DEFAULT_INDUSTRIES.map(function (industry) {
      return Object.assign({}, industry);
    });
  }

  function loadIndustries() {
    try {
      var saved = localStorage.getItem(INDUSTRIES_KEY);
      var parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length
        ? parsed
        : cloneDefaultIndustries();
    } catch (error) {
      return cloneDefaultIndustries();
    }
  }

  async function saveIndustries() {
    localStorage.setItem(INDUSTRIES_KEY, JSON.stringify(state.industries));
    await CatalogStore.saveCatalog(state.products, state.industries);
  }

  function getMasterAccount() {
    try {
      var saved = localStorage.getItem(MASTER_ACCOUNT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      return null;
    }
  }

  async function hashMasterPassword(password) {
    var bytes = new TextEncoder().encode(password);
    var digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(function (value) {
        return value.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function requireMasterAccess() {
    if (state.masterAuthenticated) {
      return true;
    }
    window.location.hash = "#/gestao";
    showToast("Entre com o acesso master para continuar.", "error");
    return false;
  }

  function hasGoogleDriveAccess() {
    return (
      Boolean(state.googleAccessToken) &&
      Date.now() < state.googleTokenExpiresAt - 60000
    );
  }

  function updateGoogleDriveStatus() {
    var status = document.getElementById("google-drive-status");
    var button = document.getElementById("google-drive-connect");
    if (!status || !button) {
      return;
    }
    var connected = hasGoogleDriveAccess();
    var expectedEmail =
      state.accessRole === "editor" ? GOOGLE_EDITOR_EMAIL : GOOGLE_ADMIN_EMAIL;
    status.textContent = connected
      ? "Google Drive conectado como " + state.googleAccountEmail + ". As novas imagens serão enviadas para a pasta da indústria."
      : "Conecte exatamente a conta " + expectedEmail + " antes de cadastrar imagens.";
    status.classList.toggle("connected", connected);
    button.textContent = connected ? "Reconectar Google Drive" : "Conectar Google Drive";
  }

  function connectGoogleDrive() {
    if (!requireMasterAccess()) {
      return;
    }
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      showToast("O login Google ainda está carregando. Tente novamente.", "error");
      return;
    }

    var tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      hint: state.accessRole === "editor" ? GOOGLE_EDITOR_EMAIL : GOOGLE_ADMIN_EMAIL,
      callback: async function (response) {
        if (!response || response.error || !response.access_token) {
          showToast("Não foi possível conectar ao Google Drive.", "error");
          return;
        }
        state.googleAccessToken = response.access_token;
        state.googleTokenExpiresAt =
          Date.now() + Number(response.expires_in || 3600) * 1000;
        try {
          var profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + state.googleAccessToken },
          });
          var profile = profileResponse.ok ? await profileResponse.json() : {};
          state.googleAccountEmail = String(profile.email || "").toLowerCase();
          var expectedEmail = state.accessRole === "editor" ? GOOGLE_EDITOR_EMAIL : GOOGLE_ADMIN_EMAIL;
          if (state.googleAccountEmail !== expectedEmail) {
            var connectedEmail = state.googleAccountEmail || "uma conta diferente";
            state.googleAccessToken = "";
            state.googleTokenExpiresAt = 0;
            state.googleAccountEmail = "";
            updateGoogleDriveStatus();
            showToast("Conta conectada: " + connectedEmail + ". Selecione " + expectedEmail + ".", "error");
            return;
          }
          updateGoogleDriveStatus();
          if (state.products.length || state.industries.length) {
            await CatalogStore.saveCatalog(state.products, state.industries);
          }
          showToast(
            "Google Drive conectado e catálogo sincronizado.",
            "success",
          );
        } catch (syncError) {
          showToast(syncError.message || "Falha ao sincronizar o catálogo.", "error");
        }
      },
      error_callback: function () {
        showToast("A janela de autorização do Google foi fechada.", "error");
      },
    });
    tokenClient.requestAccessToken({ prompt: "select_account consent" });
  }

  function loginAsGoogleEditor() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      showToast("O login Google ainda está carregando. Tente novamente.", "error");
      return;
    }
    var tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      hint: GOOGLE_EDITOR_EMAIL,
      callback: async function (response) {
        if (!response || response.error || !response.access_token) {
          showToast("Não foi possível autorizar o editor.", "error");
          return;
        }
        try {
          var profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + response.access_token },
          });
          var profile = profileResponse.ok ? await profileResponse.json() : {};
          var email = String(profile.email || "").toLowerCase();
          if (email !== GOOGLE_EDITOR_EMAIL) {
            showToast("Essa conta Google não está autorizada como editor.", "error");
            return;
          }
          state.googleAccessToken = response.access_token;
          state.googleTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
          state.googleAccountEmail = email;
          state.masterAuthenticated = true;
          state.accessRole = "editor";
          sessionStorage.setItem("fe-master-session", "active");
          sessionStorage.setItem("fe-access-role", "editor");
          renderManagement("");
          showToast("Acesso de editor autorizado.", "success");
        } catch (error) {
          showToast("Não foi possível validar a conta Google.", "error");
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "select_account consent" });
  }

  async function syncCatalogNow() {
    if (!requireMasterAccess()) return;
    if (!hasGoogleDriveAccess()) {
      showToast(
        "Autorize a conta Google; a sincronização continuará automaticamente.",
        "success",
      );
      connectGoogleDrive();
      return;
    }
    var button = document.getElementById("catalog-sync");
    if (button) {
      button.disabled = true;
      button.textContent = "Sincronizando...";
    }
    try {
      await CatalogStore.saveCatalog(state.products, state.industries);
      showToast(
        "Catálogo sincronizado para celulares e outros computadores.",
        "success",
      );
    } catch (error) {
      showToast(error.message || "Não foi possível sincronizar.", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Sincronizar catálogo agora";
      }
    }
  }

  async function googleDriveRequest(url, options) {
    if (!hasGoogleDriveAccess()) {
      throw new Error("Conecte novamente o Google Drive.");
    }
    var requestOptions = options || {};
    requestOptions.headers = Object.assign({}, requestOptions.headers, {
      Authorization: "Bearer " + state.googleAccessToken,
    });
    var response = await fetch(url, requestOptions);
    if (!response.ok) {
      var details = await response.text();
      if (response.status === 401) {
        state.googleAccessToken = "";
        state.googleTokenExpiresAt = 0;
        updateGoogleDriveStatus();
      }
      throw new Error(
        "Falha no Google Drive (" + response.status + "): " + details.slice(0, 180),
      );
    }
    return response.status === 204 ? null : response.json();
  }

  function escapeDriveQuery(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  async function findOrCreateIndustryFolder(industry) {
    var query =
      "'" +
      GOOGLE_DRIVE_ROOT_FOLDER_ID +
      "' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name='" +
      escapeDriveQuery(industry.name) +
      "'";
    var searchUrl =
      "https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)&q=" +
      encodeURIComponent(query);
    var result = await googleDriveRequest(searchUrl, { method: "GET" });
    if (result.files && result.files.length) {
      return result.files[0].id;
    }

    var created = await googleDriveRequest(
      "https://www.googleapis.com/drive/v3/files?fields=id,name",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: industry.name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [GOOGLE_DRIVE_ROOT_FOLDER_ID],
        }),
      },
    );
    return created.id;
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mimeMatch = parts[0].match(/data:([^;]+)/);
    var binary = atob(parts[1]);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], {
      type: mimeMatch ? mimeMatch[1] : "image/png",
    });
  }

  async function uploadProductImageToDrive(dataUrl, productName, industry) {
    var folderId = await findOrCreateIndustryFolder(industry);
    var fileName =
      createIndustrySlug(productName) + "-" + Date.now().toString(36) + ".png";
    var metadata = {
      name: fileName,
      mimeType: "image/png",
      parents: [folderId],
    };
    var boundary = "fe_catalogo_" + Date.now().toString(36);
    var body = new Blob(
      [
        "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n",
        JSON.stringify(metadata),
        "\r\n--" + boundary + "\r\nContent-Type: image/png\r\n\r\n",
        dataUrlToBlob(dataUrl),
        "\r\n--" + boundary + "--",
      ],
      { type: "multipart/related; boundary=" + boundary },
    );
    var uploaded = await googleDriveRequest(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body: body,
      },
    );

    await googleDriveRequest(
      "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(uploaded.id) +
        "/permissions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "anyone", role: "reader" }),
      },
    );

    return {
      fileId: uploaded.id,
      url:
        "https://drive.google.com/thumbnail?id=" +
        encodeURIComponent(uploaded.id) +
        "&sz=w1600",
    };
  }

  var app = document.getElementById("app");
  var toastElement = document.getElementById("toast");
  var confirmDialog = document.getElementById("confirm-dialog");
  var toastTimer = null;

  var icons = {
    catalog:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.55 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.45 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.44.55.79 1 .96.2.08.42.12.64.12H21v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
    back:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5"/></svg>',
    package:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></svg>',
    print:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>',
    upload:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 14v5h14v-5"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2m-8 0 1 14h8l1-14"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m-4-4 4 4 4-4"/><path d="M5 19h14"/></svg>',
    import:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4m-4 4 4-4 4 4"/><path d="M5 19h14"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>',
  };

  var CatalogStore = (function () {
    var DB_NAME = "fe-catalogo-produtos";
    var DB_VERSION = 1;
    var STORE_NAME = "products";
    var FALLBACK_KEY = "fe-catalogo-produtos-fallback-v1";
    var dbPromise = null;
    var fallbackMode = false;

    async function remoteRequest(options) {
      var response = await fetch("/api/catalog", options || {});
      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(
          payload.error || "Falha ao acessar o catálogo compartilhado.",
        );
      }
      return payload;
    }

    async function saveCatalog(products, industries) {
      if (!hasGoogleDriveAccess()) {
        throw new Error(
          "Conecte a conta Google administradora para sincronizar.",
        );
      }
      return remoteRequest({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + state.googleAccessToken,
        },
        body: JSON.stringify({ products: products, industries: industries }),
      });
    }

    function openDatabase() {
      // Browsers treat file:// storage origins inconsistently. When the
      // catalog is opened directly from disk, use the localStorage fallback.
      if (window.location.protocol === "file:") {
        return Promise.reject(new Error("Modo de arquivo local"));
      }
      if (!window.indexedDB) {
        return Promise.reject(new Error("IndexedDB indisponível"));
      }

      if (dbPromise) {
        return dbPromise;
      }

      dbPromise = new Promise(function (resolve, reject) {
        var request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function () {
          var db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            var store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("industry", "industry", { unique: false });
            store.createIndex("mateusCode", "mateusCode", { unique: false });
          }
        };

        request.onsuccess = function () {
          resolve(request.result);
        };

        request.onerror = function () {
          reject(request.error || new Error("Não foi possível abrir o catálogo local."));
        };
      });

      return dbPromise;
    }

    function requestAsPromise(request) {
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error || new Error("Falha ao acessar os produtos."));
        };
      });
    }

    function transactionAsPromise(transaction) {
      return new Promise(function (resolve, reject) {
        transaction.oncomplete = function () {
          resolve();
        };
        transaction.onerror = function () {
          reject(transaction.error || new Error("Falha ao salvar os produtos."));
        };
        transaction.onabort = function () {
          reject(transaction.error || new Error("Operação cancelada."));
        };
      });
    }

    function getFallbackProducts() {
      try {
        var data = window.localStorage.getItem(FALLBACK_KEY);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        return [];
      }
    }

    function saveFallbackProducts(products) {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(products));
    }

    function switchToFallback() {
      fallbackMode = true;
    }

    async function list() {
      if (window.location.protocol !== "file:") {
        try {
          var shared = await remoteRequest();
          if (Array.isArray(shared.industries) && shared.industries.length) {
            state.industries = shared.industries;
            localStorage.setItem(
              INDUSTRIES_KEY,
              JSON.stringify(state.industries),
            );
          }
          var sharedProducts = Array.isArray(shared.products)
            ? shared.products
            : [];
          // No site publicado, o catálogo compartilhado é a única fonte de
          // verdade. Limpe a base legada para produtos excluídos não voltarem.
          try {
            var localDb = await openDatabase();
            var localTransaction = localDb.transaction(STORE_NAME, "readwrite");
            localTransaction.objectStore(STORE_NAME).clear();
            await transactionAsPromise(localTransaction);
          } catch (localError) {
            console.warn(localError);
          }
          localStorage.removeItem(FALLBACK_KEY);
          return sharedProducts;
        } catch (remoteError) {
          console.warn(remoteError);
        }
      }
      if (fallbackMode) {
        return getFallbackProducts();
      }

      try {
        var db = await openDatabase();
        var transaction = db.transaction(STORE_NAME, "readonly");
        var request = transaction.objectStore(STORE_NAME).getAll();
        var products = await requestAsPromise(request);
        await transactionAsPromise(transaction);
        return products;
      } catch (error) {
        switchToFallback();
        return getFallbackProducts();
      }
    }

    async function put(product) {
      if (window.location.protocol !== "file:") {
        var sharedProducts = state.products.slice();
        var sharedIndex = sharedProducts.findIndex(function (item) {
          return item.id === product.id;
        });
        if (sharedIndex >= 0) {
          sharedProducts[sharedIndex] = product;
        } else {
          sharedProducts.push(product);
        }
        await saveCatalog(sharedProducts, state.industries);
        return product;
      }
      if (fallbackMode) {
        var fallbackProducts = getFallbackProducts();
        var existingIndex = fallbackProducts.findIndex(function (item) {
          return item.id === product.id;
        });
        if (existingIndex >= 0) {
          fallbackProducts[existingIndex] = product;
        } else {
          fallbackProducts.push(product);
        }
        saveFallbackProducts(fallbackProducts);
        return product;
      }

      try {
        var db = await openDatabase();
        var transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(product);
        await transactionAsPromise(transaction);
        return product;
      } catch (error) {
        switchToFallback();
        return put(product);
      }
    }

    async function remove(id) {
      if (window.location.protocol !== "file:") {
        if (!hasGoogleDriveAccess()) {
          throw new Error("Conecte a conta Google administradora para retirar o produto.");
        }
        await remoteRequest({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + state.googleAccessToken,
          },
          body: JSON.stringify({ id: id }),
        });
        return;
      }
      if (fallbackMode) {
        var remaining = getFallbackProducts().filter(function (item) {
          return item.id !== id;
        });
        saveFallbackProducts(remaining);
        return;
      }

      try {
        var db = await openDatabase();
        var transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(id);
        await transactionAsPromise(transaction);
      } catch (error) {
        switchToFallback();
        return remove(id);
      }
    }

    async function replaceAll(products, industries) {
      if (window.location.protocol !== "file:") {
        await saveCatalog(products, industries || state.industries);
        return;
      }
      if (fallbackMode) {
        saveFallbackProducts(products);
        return;
      }

      try {
        var db = await openDatabase();
        var transaction = db.transaction(STORE_NAME, "readwrite");
        var store = transaction.objectStore(STORE_NAME);
        store.clear();
        products.forEach(function (product) {
          store.put(product);
        });
        await transactionAsPromise(transaction);
      } catch (error) {
        switchToFallback();
        saveFallbackProducts(products);
      }
    }

    function mode() {
      return fallbackMode ? "localStorage" : "indexedDB";
    }

    return {
      list: list,
      put: put,
      remove: remove,
      replaceAll: replaceAll,
      mode: mode,
      saveCatalog: saveCatalog,
    };
  })();

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function findIndustry(slug) {
    return state.industries.find(function (industry) {
      return industry.slug === slug;
    });
  }

  function getIndustryName(slug) {
    var industry = findIndustry(slug);
    return industry ? industry.name : "Indústria não identificada";
  }

  function productWord(count) {
    return count === 1 ? "produto" : "produtos";
  }

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.className = "toast visible " + (type || "");
    toastTimer = window.setTimeout(function () {
      toastElement.className = "toast";
    }, 3600);
  }

  function brandVisual(industry, large) {
    var sizeClass = large ? " brand-visual-large" : "";
    if (industry.logo) {
      return (
        '<div class="industry-logo-wrap' +
        sizeClass +
        '"><img src="' +
        industry.logo +
        '" alt="" /></div>'
      );
    }
    return (
      '<div class="industry-monogram' +
      sizeClass +
      '" aria-hidden="true">' +
      industry.monogram +
      "</div>"
    );
  }

  function renderHeader(active) {
    var catalogCurrent = active === "catalog" ? ' aria-current="page"' : "";
    var managementCurrent =
      active === "management" ? ' aria-current="page"' : "";

    return (
      '<header class="site-header">' +
      '<div class="header-inner">' +
      '<a class="brand-link" href="#/catalogo" aria-label="Fé Representações — Catálogo">' +
      '<img src="assets/logo-fe-representacoes.png" alt="Fé Representações — Excelência em Negócios" />' +
      "</a>" +
      '<nav class="site-nav" aria-label="Navegação principal">' +
      '<a class="nav-link" href="#/catalogo"' +
      catalogCurrent +
      ">" +
      icons.catalog +
      "<span>Catálogo</span></a>" +
      '<a class="nav-link nav-link-management" href="#/gestao"' +
      managementCurrent +
      ">" +
      icons.settings +
      "<span>Acesso master</span></a>" +
      "</nav>" +
      "</div>" +
      "</header>"
    );
  }

  function renderFooter() {
    return (
      '<footer class="site-footer">' +
      '<div class="container footer-inner">' +
      '<div class="footer-mark"><span class="footer-symbol" aria-hidden="true"></span>Fé Representações</div>' +
      '<div class="footer-legal"><span>Catálogo digital de consulta de produtos.</span>' +
      '<a href="privacidade.html">Privacidade</a><a href="termos.html">Termos</a></div>' +
      "</div>" +
      "</footer>"
    );
  }

  function renderShell(content, active) {
    app.innerHTML =
      renderHeader(active) +
      '<main id="conteudo-principal" class="page-main">' +
      content +
      "</main>" +
      renderFooter();
  }

  function getCountsByIndustry() {
    return state.products.reduce(function (counts, product) {
      counts[product.industry] = (counts[product.industry] || 0) + 1;
      return counts;
    }, {});
  }

  function industryCardMarkup(industry, count) {
    return (
      '<a class="industry-card" href="#/industria/' +
      industry.slug +
      '" aria-label="Abrir produtos da ' +
      industry.name +
      '">' +
      brandVisual(industry, false) +
      '<div class="industry-card-footer">' +
      "<div><h3>" +
      industry.name +
      '</h3><span class="industry-count">' +
      count +
      " " +
      productWord(count) +
      "</span></div>" +
      '<span class="arrow-chip" aria-hidden="true">' +
      icons.arrow +
      "</span>" +
      "</div>" +
      "</a>"
    );
  }

  function renderIndustryGrid(filterValue) {
    var grid = document.getElementById("industry-grid");
    var empty = document.getElementById("industry-search-empty");
    if (!grid || !empty) {
      return;
    }

    var counts = getCountsByIndustry();
    var normalizedFilter = normalizeText(filterValue);
    var matches = state.industries.filter(function (industry) {
      return normalizeText(industry.name).includes(normalizedFilter);
    });

    grid.innerHTML = matches
      .map(function (industry) {
        return industryCardMarkup(industry, counts[industry.slug] || 0);
      })
      .join("");
    grid.hidden = matches.length === 0;
    empty.hidden = matches.length !== 0;
  }

  function renderHome() {
    var totalProducts = state.products.length;
    var content =
      '<section class="hero">' +
      '<div class="container">' +
      '<div class="hero-panel">' +
      '<div class="hero-copy">' +
      '<p class="eyebrow">Fé Representações · Catálogo digital</p>' +
      "<h1>Produtos organizados para uma <span>consulta mais rápida.</span></h1>" +
      '<p class="hero-lead">Escolha uma indústria para visualizar somente os produtos representados por ela, com imagem, gramatura e código reduzido do Mateus.</p>' +
      "</div>" +
      '<aside class="hero-summary" aria-label="Resumo do catálogo">' +
      '<p class="hero-summary-label">Visão geral</p>' +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><strong>' +
      state.industries.length +
      '</strong><span>indústrias organizadas</span></div>' +
      '<div class="hero-stat"><strong id="hero-product-count">' +
      totalProducts +
      "</strong><span>" +
      productWord(totalProducts) +
      " no catálogo</span></div>" +
      "</div>" +
      "</aside>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="catalog-section" aria-labelledby="industry-heading">' +
      '<div class="container">' +
      '<div class="section-heading">' +
      "<div><p class=\"eyebrow\">Nossas indústrias</p><h2 id=\"industry-heading\">Selecione uma indústria</h2>" +
      "<p>Cada área reúne exclusivamente os produtos cadastrados para aquela indústria.</p></div>" +
      '<label class="search-field">' +
      '<span class="sr-only">Buscar indústria</span>' +
      icons.search +
      '<input id="industry-search" type="search" placeholder="Buscar indústria..." autocomplete="off" />' +
      "</label>" +
      "</div>" +
      '<div id="industry-grid" class="industry-grid"></div>' +
      '<div id="industry-search-empty" class="empty-state" hidden>' +
      '<div class="empty-state-icon">' +
      icons.search +
      "</div><h3>Nenhuma indústria encontrada</h3>" +
      "<p>Revise o termo pesquisado e tente novamente.</p>" +
      "</div>" +
      "</div>" +
      "</section>";

    renderShell(content, "catalog");
    renderIndustryGrid("");

    var search = document.getElementById("industry-search");
    search.addEventListener("input", function (event) {
      renderIndustryGrid(event.target.value);
    });
  }

  function emptyStateMarkup(title, copy, actionMarkup) {
    return (
      '<div class="empty-state">' +
      '<div class="empty-state-icon">' +
      icons.package +
      "</div>" +
      "<h2>" +
      title +
      "</h2><p>" +
      copy +
      "</p>" +
      (actionMarkup || "") +
      "</div>"
    );
  }

  function createProductCard(product) {
    var article = document.createElement("article");
    article.className = "product-card";
    article.innerHTML =
      '<div class="product-image-wrap"><img /></div>' +
      '<div class="product-info">' +
      '<h2 class="product-name"></h2>' +
      '<div class="product-meta">' +
      '<p class="product-weight"></p>' +
      '<div class="product-codes">' +
      '<div class="mateus-code product-code"><small>Cód. produto</small><strong></strong></div>' +
      '<div class="mateus-code mateus-code-value"><small>Cód. Mateus</small><strong></strong></div>' +
      '</div>' +
      "</div></div>";

    var image = article.querySelector("img");
    setProductImageSource(image, product);
    image.alt = product.name + ", " + product.weight;
    article.querySelector(".product-name").textContent = product.name;
    article.querySelector(".product-weight").textContent = product.weight;
    article.querySelector(".product-code strong").textContent =
      product.productCode || "—";
    article.querySelector(".mateus-code-value strong").textContent =
      product.mateusCode;
    return article;
  }

  function getProductDriveFileId(product) {
    if (product.driveFileId) {
      return product.driveFileId;
    }
    if (typeof product.image !== "string") {
      return "";
    }
    var match = product.image.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function setProductImageSource(imageElement, product) {
    var fileId = getProductDriveFileId(product);
    var sources = [];
    if (fileId) {
      sources.push(
        "https://drive.google.com/thumbnail?id=" +
          encodeURIComponent(fileId) +
          "&sz=w1600",
      );
      sources.push(
        "https://lh3.googleusercontent.com/d/" + encodeURIComponent(fileId),
      );
    }
    if (product.image && !sources.includes(product.image)) {
      sources.push(product.image);
    }
    sources.push("assets/favicon.svg");

    var sourceIndex = 0;
    imageElement.referrerPolicy = "no-referrer";
    imageElement.addEventListener("error", function () {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        imageElement.src = sources[sourceIndex];
      } else {
        imageElement.classList.add("image-load-error");
        imageElement.removeAttribute("src");
      }
    });
    imageElement.src = sources[0] || "assets/favicon.svg";
  }

  function renderPublicProducts(industry, query, category) {
    var grid = document.getElementById("product-grid");
    var resultCount = document.getElementById("product-result-count");
    if (!grid || !resultCount) {
      return;
    }

    var normalizedQuery = normalizeText(query);
    var selectedCategory = category || "all";
    var products = state.products
      .filter(function (product) {
        return product.industry === industry.slug;
      })
      .filter(function (product) {
        return selectedCategory === "all" || product.category === selectedCategory;
      })
      .filter(function (product) {
        return (
          normalizeText(product.name).includes(normalizedQuery) ||
          normalizeText(product.weight).includes(normalizedQuery) ||
          normalizeText(product.productCode).includes(normalizedQuery) ||
          normalizeText(product.mateusCode).includes(normalizedQuery)
        );
      })
      .sort(function (first, second) {
        return first.name.localeCompare(second.name, "pt-BR");
      });

    resultCount.innerHTML =
      "<strong>" +
      products.length +
      "</strong> " +
      productWord(products.length) +
      (normalizedQuery ? " encontrado" + (products.length === 1 ? "" : "s") : "");
    grid.innerHTML = "";

    if (products.length === 0) {
      grid.className = "";
      grid.innerHTML = emptyStateMarkup(
        normalizedQuery ? "Nenhum produto encontrado" : "Catálogo em preparação",
        normalizedQuery
          ? "Tente buscar por outro nome, gramatura ou código Mateus."
          : "Ainda não há produtos cadastrados para esta indústria.",
        state.masterAuthenticated
          ? '<a class="button button-dark" href="#/gestao/' +
            industry.slug +
            '">' +
            icons.plus +
            "Adicionar produto</a>"
          : "",
      );
      return;
    }

    grid.className = "product-grid";
    products.forEach(function (product) {
      grid.appendChild(createProductCard(product));
    });
  }

  function renderIndustryPage(slug) {
    var industry = findIndustry(slug);
    if (!industry) {
      renderNotFound();
      return;
    }

    var industryProducts = state.products.filter(function (product) {
      return product.industry === industry.slug;
    });
    var categoryButtons = "";
    if (industry.slug === "dacolonia-alimentos") {
      categoryButtons =
        '<button class="category-filter-button active" type="button" data-product-category="all" aria-pressed="true">Todos os produtos</button>' +
        '<button class="category-filter-button" type="button" data-product-category="zero-acucar" aria-pressed="false">Linha Zero Açúcar</button>';
    }
    if (industry.slug === "predilecta-alimentos") {
      categoryButtons =
        '<button class="category-filter-button active" type="button" data-product-category="all" aria-pressed="true">Todos</button>' +
        '<button class="category-filter-button" type="button" data-product-category="regular" aria-pressed="false">Regular</button>' +
        '<button class="category-filter-button" type="button" data-product-category="food" aria-pressed="false">Food</button>' +
        '<button class="category-filter-button" type="button" data-product-category="doces" aria-pressed="false">Doces</button>';
    }
    var categoryFilterMarkup = categoryButtons
      ? '<div class="product-category-filter" role="group" aria-label="Filtrar linha de produtos">' + categoryButtons + '</div>'
      : "";
    var content =
      '<section class="page-hero">' +
      '<div class="container">' +
      '<div class="page-back-row">' +
      '<a class="page-back-link" href="#/catalogo">' +
      icons.back +
      "<span>Voltar ao catálogo</span></a>" +
      '<nav class="breadcrumb" aria-label="Navegação estrutural"><a href="#/catalogo">Catálogo</a><span aria-hidden="true">/</span><span>' +
      industry.name +
      "</span></nav>" +
      "</div>" +
      '<div class="page-heading-card">' +
      '<div class="page-heading"><p class="eyebrow">Produtos por indústria</p><h1>' +
      industry.name +
      "</h1><p>Consulte os produtos desta indústria, suas gramaturas e os códigos reduzidos do Mateus.</p></div>" +
      brandVisual(industry, true) +
      "</div>" +
      '<div class="product-toolbar">' +
      '<div class="product-toolbar-summary"><p id="product-result-count" class="result-count"><strong>' +
      industryProducts.length +
      "</strong> " +
      productWord(industryProducts.length) +
      "</p>" + categoryFilterMarkup + "</div>" +
      '<div class="toolbar-actions">' +
      '<label class="search-field"><span class="sr-only">Buscar produto</span>' +
      icons.search +
      '<input id="product-search" type="search" placeholder="Nome, código do produto ou Mateus..." autocomplete="off" /></label>' +
      '<button id="print-catalog" class="button button-secondary" type="button">' +
      icons.print +
      "<span>Imprimir</span></button>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="product-section" aria-label="Produtos da ' +
      industry.name +
      '"><div class="container"><div id="product-grid"></div></div></section>';

    renderShell(content, "catalog");
    var selectedCategory = "all";
    var productSearch = document.getElementById("product-search");
    renderPublicProducts(industry, "", selectedCategory);

    productSearch.addEventListener("input", function (event) {
        renderPublicProducts(industry, event.target.value, selectedCategory);
      });
    document.querySelectorAll("[data-product-category]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedCategory = button.getAttribute("data-product-category") || "all";
        document.querySelectorAll("[data-product-category]").forEach(function (item) {
          var active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderPublicProducts(industry, productSearch.value, selectedCategory);
      });
    });
    document
      .getElementById("print-catalog")
      .addEventListener("click", function () {
        window.print();
      });
  }

  function industryOptionsMarkup(includeAll) {
    var options = includeAll
      ? '<option value="all">Todas as indústrias</option>'
      : '<option value="">Selecione a indústria</option>';
    return (
      options +
      state.industries.map(function (industry) {
        return (
          '<option value="' +
          industry.slug +
          '">' +
          industry.name +
          "</option>"
        );
      }).join("")
    );
  }

  function renderMasterAccess() {
    var account = getMasterAccount();
    var isSetup = !account;
    var content =
      '<section class="master-access-page"><div class="container">' +
      '<div class="master-access-card">' +
      '<div class="master-access-copy"><p class="eyebrow">Acesso restrito</p><h1>' +
      (isSetup ? "Criar acesso master" : "Entrar na gestão") +
      '</h1><p>' +
      (isSetup
        ? "Cadastre o único responsável autorizado a lançar e editar produtos neste navegador."
        : "Somente o responsável master pode cadastrar, editar ou retirar produtos.") +
      '</p></div>' +
      '<form id="master-access-form" class="master-access-form" novalidate>' +
      '<div class="field-group"><label class="field-label" for="master-user">Usuário</label>' +
      '<input id="master-user" class="field-input" type="text" maxlength="60" autocomplete="username" required /></div>' +
      '<div class="field-group"><label class="field-label" for="master-password">Senha</label>' +
      '<input id="master-password" class="field-input" type="password" minlength="8" autocomplete="' +
      (isSetup ? "new-password" : "current-password") +
      '" required /><p class="field-help">Use pelo menos 8 caracteres.</p></div>' +
      '<p id="master-access-error" class="field-error master-access-error" aria-live="polite"></p>' +
      '<button class="button button-primary master-submit" type="submit">' +
      (isSetup ? "Criar acesso master" : "Entrar") +
      '</button></form>' +
      '<button id="editor-google-login" class="button button-secondary master-submit" type="button">Entrar como editor Google</button>' +
      '<a class="master-back-link" href="#/catalogo">Voltar ao catálogo público</a>' +
      '</div></div></section>';

    renderShell(content, "management");

    document
      .getElementById("master-access-form")
      .addEventListener("submit", async function (event) {
        event.preventDefault();
        var user = document.getElementById("master-user").value.trim();
        var password = document.getElementById("master-password").value;
        var error = document.getElementById("master-access-error");
        error.textContent = "";

        if (user.length < 3 || password.length < 8) {
          error.textContent =
            "Informe um usuário válido e uma senha com pelo menos 8 caracteres.";
          return;
        }

        try {
          var passwordHash = await hashMasterPassword(password);
          if (isSetup) {
            localStorage.setItem(
              MASTER_ACCOUNT_KEY,
              JSON.stringify({ user: user, passwordHash: passwordHash }),
            );
          } else if (
            user !== account.user ||
            passwordHash !== account.passwordHash
          ) {
            error.textContent = "Usuário ou senha incorretos.";
            return;
          }

          state.masterAuthenticated = true;
          state.accessRole = "master";
          sessionStorage.setItem("fe-master-session", "active");
          sessionStorage.setItem("fe-access-role", "master");
          renderManagement("");
          showToast(
            isSetup ? "Acesso master criado." : "Acesso autorizado.",
            "success",
          );
        } catch (accessError) {
          error.textContent =
            "Não foi possível validar o acesso neste navegador.";
        }
      });
    document.getElementById("editor-google-login").addEventListener("click", loginAsGoogleEditor);
  }

  function createIndustrySlug(name) {
    return normalizeText(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function createIndustryMonogram(name) {
    var words = name.trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map(function (word) {
        return word.charAt(0).toUpperCase();
      })
      .join("");
  }

  function industryManagementMarkup() {
    var counts = getCountsByIndustry();
    return (
      '<section class="panel industry-management-panel" aria-labelledby="industry-management-title">' +
      '<div class="industry-management-header"><div><p class="eyebrow">Configuração do catálogo</p>' +
      '<h2 id="industry-management-title">Gerenciar indústrias</h2>' +
      '<p>Adicione novas representadas ou remova indústrias sem produtos vinculados.</p></div>' +
      '<form id="industry-form" class="industry-create-form" novalidate>' +
      '<label class="sr-only" for="new-industry-name">Nome da nova indústria</label>' +
      '<input id="new-industry-name" class="field-input" type="text" maxlength="80" placeholder="Nome da nova indústria" autocomplete="off" />' +
      '<button class="button button-primary" type="submit">' +
      icons.plus +
      '<span>Adicionar indústria</span></button>' +
      '<p id="industry-management-error" class="field-error" aria-live="polite"></p>' +
      '</form></div>' +
      '<div id="industry-management-list" class="industry-management-list">' +
      state.industries
        .map(function (industry) {
          var count = counts[industry.slug] || 0;
          return (
            '<article class="industry-management-item">' +
            brandVisual(industry, false) +
            '<div class="industry-management-info"><strong>' +
            industry.name +
            '</strong><span>' +
            count +
            ' ' +
            productWord(count) +
            '</span></div>' +
            '<button class="button button-danger industry-remove-button" type="button" data-remove-industry="' +
            industry.slug +
            '"' +
            (count ? ' disabled aria-disabled="true" title="Retire os produtos antes de remover"' : "") +
            '>' +
            icons.trash +
            '<span>Remover</span></button></article>'
          );
        })
        .join("") +
      '</div></section>'
    );
  }

  async function addIndustry(event) {
    event.preventDefault();
    if (!requireMasterAccess()) {
      return;
    }
    var input = document.getElementById("new-industry-name");
    var error = document.getElementById("industry-management-error");
    var name = input.value.trim().replace(/\s+/g, " ");
    var slug = createIndustrySlug(name);
    error.textContent = "";

    if (name.length < 2 || !slug || /[<>&"']/.test(name)) {
      error.textContent = "Informe o nome válido da indústria.";
      return;
    }
    if (
      state.industries.some(function (industry) {
        return industry.slug === slug || normalizeText(industry.name) === normalizeText(name);
      })
    ) {
      error.textContent = "Esta indústria já está cadastrada.";
      return;
    }

    state.industries.push({
      slug: slug,
      name: name,
      shortName: name,
      monogram: createIndustryMonogram(name),
      logo: null,
    });
    try {
      await saveIndustries();
    } catch (error) {
      state.industries = state.industries.filter(function (item) {
        return item.slug !== slug;
      });
      showToast(error.message, "error");
      return;
    }
    renderManagement("");
    showToast("Indústria adicionada ao catálogo.", "success");
  }

  async function removeIndustry(slug) {
    if (!requireMasterAccess()) {
      return;
    }
    var industry = findIndustry(slug);
    if (!industry) {
      return;
    }
    var hasProducts = state.products.some(function (product) {
      return product.industry === slug;
    });
    if (hasProducts) {
      showToast("Retire os produtos desta indústria antes de removê-la.", "error");
      return;
    }
    if (!window.confirm('Remover a indústria "' + industry.name + '" do catálogo?')) {
      return;
    }

    var previousIndustries = state.industries.slice();
    state.industries = state.industries.filter(function (item) {
      return item.slug !== slug;
    });
    try {
      await saveIndustries();
    } catch (error) {
      state.industries = previousIndustries;
      showToast(error.message, "error");
      return;
    }
    state.adminFilter = "all";
    state.defaultIndustry = "";
    renderManagement("");
    showToast("Indústria removida do catálogo.", "success");
  }

  function renderManagement(defaultIndustry) {
    if (!state.masterAuthenticated) {
      renderMasterAccess();
      return;
    }
    state.defaultIndustry = findIndustry(defaultIndustry)
      ? defaultIndustry
      : state.defaultIndustry;
    var isEditor = state.accessRole === "editor";
    var content =
      '<section class="management-page">' +
      '<div class="container">' +
      '<div class="management-heading">' +
      '<div><p class="eyebrow">' + (isEditor ? "Área do editor" : "Área master") + '</p><h1>Gerenciar catálogo</h1>' +
      '<p>' + (isEditor ? "Edite informações e imagens dos produtos existentes." : "Cadastre, edite e retire produtos de forma organizada.") + '</p>' +
      '<button id="master-logout" class="button button-secondary master-logout" type="button">Sair do acesso master</button></div>' +
      '<div class="storage-notice">' +
      icons.info +
      "<span><strong>Catálogo compartilhado:</strong> sincronize após alterações para publicar os produtos em celulares e outros computadores.</span></div>" +
      "</div>" +
      '<section class="google-drive-panel" aria-labelledby="google-drive-title">' +
      '<div><p class="eyebrow">Armazenamento de imagens</p><h2 id="google-drive-title">Google Drive</h2>' +
      '<p id="google-drive-status">Conecte a conta Google proprietária da pasta antes de cadastrar imagens.</p></div>' +
      '<div class="google-drive-actions"><button id="google-drive-connect" class="button button-secondary" type="button">Conectar Google Drive</button>' +
      '<button id="catalog-sync" class="button button-primary" type="button">Sincronizar catálogo agora</button></div>' +
      '</section>' +
      '<div' + (isEditor ? ' hidden' : '') + '>' + industryManagementMarkup() + '</div>' +
      '<div class="management-grid">' +
      '<section class="panel form-panel" aria-labelledby="form-title">' +
      '<div class="panel-heading"><div><h2 id="form-title">Novo produto</h2><p>Todos os campos marcados são obrigatórios.</p></div>' +
      '<span id="editing-badge" class="editing-badge">Editando</span></div>' +
      '<form id="product-form" novalidate>' +
      '<div class="field-group"><label class="field-label" for="industry">Indústria <span class="required-mark">*</span></label>' +
      '<select id="industry" class="field-select" name="industry">' +
      industryOptionsMarkup(false) +
      '</select><p id="industry-error" class="field-error" aria-live="polite"></p></div>' +
      '<div class="field-group"><span class="field-label">Imagem do produto <span class="required-mark">*</span></span>' +
      '<div id="upload-zone" class="upload-zone" role="button" tabindex="0" aria-describedby="image-help image-error">' +
      '<input id="product-image" name="product-image" type="file" accept=".png,image/png" />' +
      '<div id="upload-placeholder" class="upload-placeholder">' +
      icons.upload +
      "<strong>Selecione ou arraste o PNG</strong><span>Fundo transparente · máximo de 20 MB</span></div>" +
      '<div id="upload-preview" class="upload-preview"><img id="preview-image" alt="Pré-visualização do produto" /></div>' +
      '<span class="upload-change">Trocar imagem</span>' +
      "</div>" +
      '<p id="image-help" class="field-help">Use uma imagem nítida, recortada e preferencialmente com fundo transparente.</p>' +
      '<p id="image-error" class="field-error" aria-live="polite"></p></div>' +
      '<div class="field-group"><label class="field-label" for="product-name">Nome do produto <span class="required-mark">*</span></label>' +
      '<input id="product-name" class="field-input" name="product-name" type="text" maxlength="120" placeholder="Ex.: Massa pronta para tapioca" autocomplete="off" />' +
      '<p id="product-name-error" class="field-error" aria-live="polite"></p></div>' +
      '<div class="form-row">' +
      '<div class="field-group"><label class="field-label" for="product-weight">Gramatura <span class="required-mark">*</span></label>' +
      '<input id="product-weight" class="field-input" name="product-weight" type="text" maxlength="40" placeholder="Ex.: 500 g" autocomplete="off" />' +
      '<p id="product-weight-error" class="field-error" aria-live="polite"></p></div>' +
      '<div class="field-group"><label class="field-label" for="product-code">Código do produto <span class="required-mark">*</span></label>' +
      '<input id="product-code" class="field-input" name="product-code" type="text" maxlength="40" placeholder="Ex.: VF-220" autocomplete="off" />' +
      '<p id="product-code-error" class="field-error" aria-live="polite"></p></div>' +
      '</div><div class="form-row form-row-single">' +
      '<div class="field-group"><label class="field-label" for="mateus-code">Código reduzido Mateus <span class="required-mark">*</span></label>' +
      '<input id="mateus-code" class="field-input" name="mateus-code" type="text" inputmode="numeric" maxlength="20" placeholder="Ex.: 385279" autocomplete="off" />' +
      '<p id="mateus-code-error" class="field-error" aria-live="polite"></p></div>' +
      "</div>" +
      '<div class="form-actions">' +
      '<button id="cancel-edit" class="button button-secondary cancel-edit-button" type="button">Cancelar</button>' +
      '<button id="save-product" class="button button-primary" type="submit">' +
      icons.plus +
      '<span id="save-product-label">Adicionar produto</span></button>' +
      "</div>" +
      "</form>" +
      "</section>" +
      '<section class="panel list-panel" aria-labelledby="product-list-title">' +
      '<div class="list-panel-header">' +
      '<div class="panel-heading"><div><h2 id="product-list-title">Produtos cadastrados</h2>' +
      '<p id="management-count"></p></div></div>' +
      '<div class="management-tools">' +
      '<label class="search-field"><span class="sr-only">Buscar produto cadastrado</span>' +
      icons.search +
      '<input id="admin-search" type="search" placeholder="Buscar nome ou código..." autocomplete="off" /></label>' +
      '<select id="admin-filter" class="field-select compact" aria-label="Filtrar por indústria">' +
      industryOptionsMarkup(true) +
      "</select>" +
      "</div>" +
      '<div class="backup-actions"' + (isEditor ? ' hidden' : '') + '>' +
      '<button id="export-backup" class="button button-secondary" type="button">' +
      icons.download +
      "<span>Exportar backup</span></button>" +
      '<label class="button button-secondary import-label">' +
      icons.import +
      '<span>Importar backup</span><input id="import-backup" type="file" accept=".json,application/json" /></label>' +
      "</div>" +
      "</div>" +
      '<div id="product-list" class="product-list"></div>' +
      "</section>" +
      "</div>" +
      "</div>" +
      "</section>";

    renderShell(content, "management");
    setupManagement(defaultIndustry);
  }

  function setupManagement(defaultIndustry) {
    var form = document.getElementById("product-form");
    var industrySelect = document.getElementById("industry");
    var fileInput = document.getElementById("product-image");
    var uploadZone = document.getElementById("upload-zone");
    var adminSearch = document.getElementById("admin-search");
    var adminFilter = document.getElementById("admin-filter");
    var productList = document.getElementById("product-list");

    if (findIndustry(defaultIndustry)) {
      industrySelect.value = defaultIndustry;
      state.adminFilter = defaultIndustry;
    } else if (findIndustry(state.defaultIndustry)) {
      industrySelect.value = state.defaultIndustry;
    }

    adminSearch.value = state.adminSearch;
    adminFilter.value = state.adminFilter;
    renderManagementList();
    updateGoogleDriveStatus();
    if (state.accessRole === "editor" && !state.editingId) {
      resetEditor();
    }

    document
      .getElementById("google-drive-connect")
      .addEventListener("click", connectGoogleDrive);
    document
      .getElementById("catalog-sync")
      .addEventListener("click", syncCatalogNow);

    document
      .getElementById("industry-form")
      .addEventListener("submit", addIndustry);
    document
      .getElementById("industry-management-list")
      .addEventListener("click", function (event) {
        var button = event.target.closest("[data-remove-industry]");
        if (button && !button.disabled) {
          removeIndustry(button.getAttribute("data-remove-industry"));
        }
      });

    document.getElementById("master-logout").addEventListener("click", function () {
      state.masterAuthenticated = false;
      sessionStorage.removeItem("fe-master-session");
      sessionStorage.removeItem("fe-access-role");
      state.accessRole = "master";
      state.editingId = null;
      state.pendingImage = null;
      renderMasterAccess();
      showToast("Sessão master encerrada.", "success");
    });

    form.addEventListener("submit", handleProductSubmit);
    document
      .getElementById("cancel-edit")
      .addEventListener("click", resetEditor);

    uploadZone.addEventListener("click", function (event) {
      if (event.target !== fileInput) {
        fileInput.click();
      }
    });
    uploadZone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener("change", function () {
      handleImageFile(fileInput.files && fileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
      uploadZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        uploadZone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (eventName) {
      uploadZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        uploadZone.classList.remove("dragging");
      });
    });
    uploadZone.addEventListener("drop", function (event) {
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      handleImageFile(file);
    });

    adminSearch.addEventListener("input", function (event) {
      state.adminSearch = event.target.value;
      renderManagementList();
    });
    adminFilter.addEventListener("change", function (event) {
      state.adminFilter = event.target.value;
      renderManagementList();
    });

    productList.addEventListener("click", function (event) {
      var actionButton = event.target.closest("[data-action]");
      if (!actionButton) {
        return;
      }
      var id = actionButton.getAttribute("data-id");
      if (actionButton.getAttribute("data-action") === "edit") {
        startEditing(id);
      }
      if (actionButton.getAttribute("data-action") === "remove") {
        requestRemoval(id);
      }
    });

    document
      .getElementById("export-backup")
      .addEventListener("click", exportBackup);
    document
      .getElementById("import-backup")
      .addEventListener("change", handleBackupImport);
  }

  function clearFieldErrors() {
    [
      "industry",
      "product-name",
      "product-weight",
      "product-code",
      "mateus-code",
    ].forEach(function (fieldId) {
      var field = document.getElementById(fieldId);
      var error = document.getElementById(fieldId + "-error");
      if (field) {
        field.removeAttribute("aria-invalid");
      }
      if (error) {
        error.textContent = "";
      }
    });
    var imageError = document.getElementById("image-error");
    if (imageError) {
      imageError.textContent = "";
    }
  }

  function setFieldError(fieldId, message) {
    var field = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + "-error");
    if (field) {
      field.setAttribute("aria-invalid", "true");
    }
    if (error) {
      error.textContent = message;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("Não foi possível ler a imagem."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function hasValidPngSignature(file) {
    var expectedSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    var header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    return expectedSignature.every(function (byte, index) {
      return header[index] === byte;
    });
  }

  async function handleImageFile(file) {
    var errorElement = document.getElementById("image-error");
    if (errorElement) {
      errorElement.textContent = "";
    }
    if (!file) {
      return;
    }

    var hasPngName = file.name.toLowerCase().endsWith(".png");
    var hasPngType = !file.type || file.type === "image/png";
    if (!hasPngName || !hasPngType) {
      errorElement.textContent = "Envie uma imagem no formato PNG.";
      document.getElementById("product-image").value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      errorElement.textContent = "A imagem deve ter no máximo 20 MB.";
      document.getElementById("product-image").value = "";
      return;
    }

    try {
      if (!(await hasValidPngSignature(file))) {
        throw new Error("O arquivo selecionado não é um PNG válido.");
      }
      var dataUrl = await readFileAsDataUrl(file);
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png")) {
        throw new Error("Arquivo PNG inválido.");
      }
      state.pendingImage = dataUrl;
      setUploadPreview(dataUrl);
    } catch (error) {
      errorElement.textContent =
        error.message || "Não foi possível carregar a imagem.";
    }
  }

  function setUploadPreview(dataUrl) {
    var placeholder = document.getElementById("upload-placeholder");
    var preview = document.getElementById("upload-preview");
    var image = document.getElementById("preview-image");
    if (!placeholder || !preview || !image) {
      return;
    }

    if (dataUrl) {
      image.src = dataUrl;
      placeholder.style.display = "none";
      preview.classList.add("visible");
    } else {
      image.removeAttribute("src");
      placeholder.style.display = "";
      preview.classList.remove("visible");
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (state.accessRole === "editor" && !state.editingId) {
      showToast("O editor pode alterar apenas produtos existentes.", "error");
      return;
    }
    if (!requireMasterAccess()) {
      return;
    }
    clearFieldErrors();

    var industry = document.getElementById("industry").value;
    var name = document
      .getElementById("product-name")
      .value.trim()
      .replace(/\s+/g, " ");
    var weight = document
      .getElementById("product-weight")
      .value.trim()
      .replace(/\s+/g, " ");
    var productCode = document
      .getElementById("product-code")
      .value.trim()
      .replace(/\s+/g, " ");
    var mateusCode = document
      .getElementById("mateus-code")
      .value.trim()
      .replace(/\s+/g, "");
    var existing = state.editingId
      ? state.products.find(function (product) {
          return product.id === state.editingId;
        })
      : null;
    var image = state.pendingImage || (existing && existing.image);
    var valid = true;

    if (!findIndustry(industry)) {
      setFieldError("industry", "Selecione a indústria do produto.");
      valid = false;
    }
    if (name.length < 2) {
      setFieldError("product-name", "Informe o nome do produto.");
      valid = false;
    }
    if (!weight) {
      setFieldError("product-weight", "Informe a gramatura e a unidade.");
      valid = false;
    }
    if (!/^[A-Za-z0-9.*_\/-]{1,40}$/.test(productCode)) {
      setFieldError(
        "product-code",
        "Informe o código usando letras, números, asterisco, ponto, hífen ou barra.",
      );
      valid = false;
    }
    if (!/^(?:\d{1,20}|PENDENTE-[A-Za-z0-9-]{1,30})$/.test(mateusCode)) {
      setFieldError(
        "mateus-code",
        "Use somente números, preservando eventuais zeros iniciais.",
      );
      valid = false;
    }
    var duplicateCode = state.products.find(function (product) {
      return (
        product.mateusCode === mateusCode && product.id !== state.editingId
      );
    });
    if (duplicateCode) {
      setFieldError(
        "mateus-code",
        "Este código já está vinculado a " + duplicateCode.name + ".",
      );
      valid = false;
    }
    var duplicateProductCode = state.products.find(function (product) {
      return (
        normalizeText(product.productCode) === normalizeText(productCode) &&
        product.id !== state.editingId
      );
    });
    if (duplicateProductCode) {
      setFieldError(
        "product-code",
        "Este código já está vinculado a " + duplicateProductCode.name + ".",
      );
      valid = false;
    }
    if (!image) {
      document.getElementById("image-error").textContent =
        "Adicione a imagem PNG do produto.";
      valid = false;
    }

    if (!valid) {
      showToast("Revise os campos destacados.", "error");
      return;
    }

    if (
      state.pendingImage &&
      state.pendingImage.startsWith("data:image/png") &&
      !hasGoogleDriveAccess()
    ) {
      document.getElementById("image-error").textContent =
        "Conecte o Google Drive antes de enviar uma nova imagem.";
      showToast("Conecte o Google Drive para salvar a imagem.", "error");
      return;
    }

    var saveButton = document.getElementById("save-product");
    var saveLabel = document.getElementById("save-product-label");
    saveButton.disabled = true;
    saveLabel.textContent = "Salvando...";

    try {
      var driveFileId = existing ? existing.driveFileId || "" : "";
      if (state.pendingImage && state.pendingImage.startsWith("data:image/png")) {
        saveLabel.textContent = "Enviando ao Drive...";
        var uploadedImage = await uploadProductImageToDrive(
          state.pendingImage,
          name,
          findIndustry(industry),
        );
        image = uploadedImage.url;
        driveFileId = uploadedImage.fileId;
        saveLabel.textContent = "Salvando produto...";
      }

      var now = new Date().toISOString();
      var product = {
        id: existing ? existing.id : createId(),
        industry: industry,
        name: name,
        weight: weight,
        productCode: productCode,
        mateusCode: mateusCode,
        category: existing ? existing.category || "" : "",
        image: image,
        driveFileId: driveFileId,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      };
      await CatalogStore.put(product);
      state.products = await CatalogStore.list();
      var wasEditing = Boolean(existing);
      resetEditor();
      renderManagementList();
      showToast(
        wasEditing
          ? "Produto atualizado com sucesso."
          : "Produto adicionado ao catálogo.",
        "success",
      );
    } catch (error) {
      showToast(
        error.message ||
          "Não foi possível salvar. Exporte um backup e tente novamente.",
        "error",
      );
    } finally {
      var editorWithoutSelection =
        state.accessRole === "editor" && !state.editingId;
      saveButton.disabled = editorWithoutSelection;
      if (!state.editingId) {
        saveLabel.textContent = editorWithoutSelection
          ? "Selecione um produto para editar"
          : "Adicionar produto";
      }
    }
  }

  function resetEditor() {
    var form = document.getElementById("product-form");
    if (!form) {
      state.editingId = null;
      state.pendingImage = null;
      return;
    }

    var selectedIndustry = document.getElementById("industry").value;
    state.editingId = null;
    state.pendingImage = null;
    form.reset();
    if (findIndustry(selectedIndustry)) {
      document.getElementById("industry").value = selectedIndustry;
    } else if (findIndustry(state.defaultIndustry)) {
      document.getElementById("industry").value = state.defaultIndustry;
    }
    clearFieldErrors();
    setUploadPreview(null);
    document.getElementById("form-title").textContent =
      state.accessRole === "editor" ? "Selecione um produto" : "Novo produto";
    document.getElementById("editing-badge").classList.remove("visible");
    document.getElementById("cancel-edit").classList.remove("visible");
    document.getElementById("save-product-label").textContent =
      state.accessRole === "editor" ? "Selecione um produto para editar" : "Adicionar produto";
    document.getElementById("save-product").disabled = state.accessRole === "editor";
  }

  function startEditing(id) {
    var product = state.products.find(function (item) {
      return item.id === id;
    });
    if (!product) {
      showToast("Produto não encontrado.", "error");
      return;
    }

    state.editingId = product.id;
    state.pendingImage = product.image;
    clearFieldErrors();
    document.getElementById("industry").value = product.industry;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-weight").value = product.weight;
    document.getElementById("product-code").value = product.productCode || "";
    document.getElementById("mateus-code").value = product.mateusCode;
    setUploadPreview(product.image);
    document.getElementById("form-title").textContent = "Editar produto";
    document.getElementById("editing-badge").classList.add("visible");
    document.getElementById("cancel-edit").classList.add("visible");
    document.getElementById("save-product-label").textContent =
      "Salvar alterações";
    document.getElementById("save-product").disabled = false;
    document
      .querySelector(".form-panel")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function createProductRow(product) {
    var row = document.createElement("article");
    row.className = "product-row";
    row.innerHTML =
      '<div class="product-row-image"><img /></div>' +
      '<div class="product-row-copy"><h3></h3><div class="product-row-meta">' +
      '<span class="meta-chip industry-chip"></span>' +
      '<span class="meta-chip weight-chip"></span>' +
      '<span class="meta-chip product-code-chip"></span>' +
      '<span class="meta-chip mateus-code-chip"></span>' +
      "</div></div>" +
      '<div class="row-actions">' +
      '<button class="button button-secondary" type="button" data-action="edit">' +
      icons.edit +
      "<span>Editar</span></button>" +
      (state.accessRole === "editor" ? "" :
      '<button class="button button-ghost-danger" type="button" data-action="remove">' +
      icons.trash +
      "<span>Retirar</span></button>") +
      "</div>";

    var image = row.querySelector("img");
    setProductImageSource(image, product);
    image.alt = "";
    row.querySelector("h3").textContent = product.name;
    row.querySelector(".industry-chip").textContent = getIndustryName(
      product.industry,
    );
    row.querySelector(".weight-chip").textContent = product.weight;
    row.querySelector(".product-code-chip").textContent =
      "Produto: " + (product.productCode || "não informado");
    row.querySelector(".mateus-code-chip").textContent =
      "Mateus: " + product.mateusCode;
    row.querySelectorAll("[data-action]").forEach(function (button) {
      button.setAttribute("data-id", product.id);
    });
    return row;
  }

  function renderManagementList() {
    var list = document.getElementById("product-list");
    var count = document.getElementById("management-count");
    if (!list || !count) {
      return;
    }

    var normalizedSearch = normalizeText(state.adminSearch);
    var products = state.products
      .filter(function (product) {
        return (
          state.adminFilter === "all" ||
          product.industry === state.adminFilter
        );
      })
      .filter(function (product) {
        return (
          normalizeText(product.name).includes(normalizedSearch) ||
          normalizeText(product.productCode).includes(normalizedSearch) ||
          normalizeText(product.mateusCode).includes(normalizedSearch) ||
          normalizeText(product.weight).includes(normalizedSearch)
        );
      })
      .sort(function (first, second) {
        return (
          getIndustryName(first.industry).localeCompare(
            getIndustryName(second.industry),
            "pt-BR",
          ) || first.name.localeCompare(second.name, "pt-BR")
        );
      });

    count.textContent =
      products.length +
      " " +
      productWord(products.length) +
      (state.adminSearch || state.adminFilter !== "all"
        ? " neste filtro"
        : " no total");
    list.innerHTML = "";

    if (products.length === 0) {
      list.innerHTML =
        '<div class="list-empty"><strong>Nenhum produto encontrado</strong>' +
        "<span>Cadastre o primeiro produto ou ajuste os filtros.</span></div>";
      return;
    }

    products.forEach(function (product) {
      list.appendChild(createProductRow(product));
    });
  }

  function requestRemoval(id) {
    if (!requireMasterAccess()) {
      return;
    }
    var product = state.products.find(function (item) {
      return item.id === id;
    });
    if (!product) {
      return;
    }

    state.removeId = product.id;
    confirmDialog.dataset.action = "remove";
    confirmDialog.querySelector("h2").textContent = "Retirar este produto?";
    document.getElementById("confirm-message").textContent =
      product.name +
      " será removido deste navegador e deixará de aparecer no catálogo.";
    document.getElementById("confirm-remove").textContent = "Retirar produto";
    confirmDialog.showModal();
  }

  async function removeConfirmedProduct() {
    if (!requireMasterAccess()) {
      return;
    }
    if (!state.removeId) {
      return;
    }

    var id = state.removeId;
    state.removeId = null;
    try {
      await CatalogStore.remove(id);
      state.products = await CatalogStore.list();
      if (state.editingId === id) {
        resetEditor();
      }
      renderManagementList();
      showToast("Produto retirado do catálogo.", "success");
    } catch (error) {
      showToast("Não foi possível retirar o produto.", "error");
    }
  }

  function exportBackup() {
    if (!requireMasterAccess()) {
      return;
    }
    var backup = {
      format: "fe-catalogo-produtos",
      version: 2,
      exportedAt: new Date().toISOString(),
      industries: state.industries,
      products: state.products,
    };
    var blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      "catalogo-fe-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado com sucesso.", "success");
  }

  function validateBackup(data) {
    if (
      !data ||
      data.format !== "fe-catalogo-produtos" ||
      (data.version !== 1 && data.version !== 2) ||
      !Array.isArray(data.products)
    ) {
      throw new Error("Este arquivo não é um backup válido do catálogo.");
    }

    var importedIndustries =
      data.version === 2 && Array.isArray(data.industries)
        ? data.industries
            .filter(function (industry) {
              return (
                industry &&
                typeof industry.slug === "string" &&
                /^[a-z0-9-]{1,60}$/.test(industry.slug) &&
                typeof industry.name === "string" &&
                industry.name.trim().length >= 2
              );
            })
            .map(function (industry) {
              var name = industry.name.trim().slice(0, 80);
              return {
                slug: industry.slug,
                name: name,
                shortName: name,
                monogram: createIndustryMonogram(name),
                logo:
                  typeof industry.logo === "string" ? industry.logo : null,
              };
            })
        : state.industries;

    if (!importedIndustries.length) {
      throw new Error("O backup não contém indústrias válidas.");
    }

    var knownIndustries = new Set(
      importedIndustries.map(function (industry) {
        return industry.slug;
      }),
    );
    var usedCodes = new Set();
    var usedProductCodes = new Set();
    var usedIds = new Set();
    var products = data.products.map(function (product) {
      if (
        !product ||
        typeof product.id !== "string" ||
        product.id.length < 3 ||
        !knownIndustries.has(product.industry) ||
        typeof product.name !== "string" ||
        product.name.trim().length < 2 ||
        typeof product.weight !== "string" ||
        product.weight.trim().length < 1 ||
        typeof product.mateusCode !== "string" ||
        !/^(?:\d{1,20}|PENDENTE-[A-Za-z0-9-]{1,30})$/.test(product.mateusCode) ||
        (typeof product.productCode === "string" &&
          product.productCode.length > 0 &&
          !/^[A-Za-z0-9.*_\/-]{1,40}$/.test(product.productCode)) ||
        typeof product.image !== "string" ||
        (!product.image.startsWith("data:image/png;base64,") &&
          !/^https:\/\/drive\.google\.com\/(uc|thumbnail)\?/.test(
            product.image,
          ) &&
          !/^https:\/\/lh3\.googleusercontent\.com\/d\//.test(product.image) &&
          product.image !== "")
      ) {
        throw new Error("O backup contém um produto inválido.");
      }
      if (product.image.length > 30 * 1024 * 1024) {
        throw new Error("O backup contém uma imagem acima do limite.");
      }
      if (usedCodes.has(product.mateusCode)) {
        throw new Error(
          "O backup possui códigos Mateus duplicados: " +
            product.mateusCode +
            ".",
        );
      }
      if (
        product.productCode &&
        usedProductCodes.has(normalizeText(product.productCode))
      ) {
        throw new Error(
          "O backup possui códigos de produto duplicados: " +
            product.productCode +
            ".",
        );
      }
      if (usedIds.has(product.id)) {
        throw new Error("O backup possui identificadores duplicados.");
      }
      usedCodes.add(product.mateusCode);
      if (product.productCode) {
        usedProductCodes.add(normalizeText(product.productCode));
      }
      usedIds.add(product.id);
      return {
        id: product.id,
        industry: product.industry,
        name: product.name.trim().slice(0, 120),
        weight: product.weight.trim().slice(0, 40),
        productCode:
          typeof product.productCode === "string"
            ? product.productCode.trim().slice(0, 40)
            : "",
        mateusCode: product.mateusCode,
        image: product.image,
        driveFileId:
          typeof product.driveFileId === "string" ? product.driveFileId : "",
        createdAt:
          typeof product.createdAt === "string"
            ? product.createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    return { products: products, industries: importedIndustries };
  }

  async function handleBackupImport(event) {
    if (!requireMasterAccess()) {
      return;
    }
    var input = event.target;
    var file = input.files && input.files[0];
    if (!file) {
      return;
    }

    try {
      if (file.size > 60 * 1024 * 1024) {
        throw new Error("O arquivo de backup excede 60 MB.");
      }
      var parsed = JSON.parse(await file.text());
      var importedBackup = validateBackup(parsed);
      var importedProducts = importedBackup.products;
      var confirmed = window.confirm(
        "Importar este backup substituirá os produtos deste navegador. Deseja continuar?",
      );
      if (!confirmed) {
        return;
      }
      await CatalogStore.replaceAll(
        importedProducts,
        importedBackup.industries,
      );
      state.industries = importedBackup.industries;
      localStorage.setItem(
        INDUSTRIES_KEY,
        JSON.stringify(state.industries),
      );
      state.products = await CatalogStore.list();
      resetEditor();
      renderManagement("");
      showToast(
        importedProducts.length +
          " " +
          productWord(importedProducts.length) +
          " importados.",
        "success",
      );
    } catch (error) {
      showToast(error.message || "Não foi possível importar o backup.", "error");
    } finally {
      input.value = "";
    }
  }

  function renderNotFound() {
    var content =
      '<section class="catalog-section"><div class="container">' +
      emptyStateMarkup(
        "Página não encontrada",
        "A indústria ou a área solicitada não existe neste catálogo.",
        '<a class="button button-dark" href="#/catalogo">Voltar ao catálogo</a>',
      ) +
      "</div></section>";
    renderShell(content, "catalog");
  }

  function parseRoute() {
    var cleanHash = window.location.hash.replace(/^#\/?/, "");
    var parts = cleanHash.split("/").filter(Boolean);
    if (parts.length === 0 || parts[0] === "catalogo") {
      return { name: "home" };
    }
    if (parts[0] === "industria" && parts[1]) {
      return { name: "industry", slug: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === "gestao") {
      return {
        name: "management",
        industry: parts[1] ? decodeURIComponent(parts[1]) : "",
      };
    }
    return { name: "not-found" };
  }

  function renderRoute() {
    var route = parseRoute();
    if (route.name !== "management") {
      state.editingId = null;
      state.pendingImage = null;
    }

    if (route.name === "home") {
      document.title = "Catálogo de Produtos | Fé Representações";
      renderHome();
    } else if (route.name === "industry") {
      var industry = findIndustry(route.slug);
      document.title = industry
        ? industry.name + " | Catálogo Fé Representações"
        : "Página não encontrada | Fé Representações";
      renderIndustryPage(route.slug);
    } else if (route.name === "management") {
      document.title = "Gerenciar Catálogo | Fé Representações";
      renderManagement(route.industry);
    } else {
      document.title = "Página não encontrada | Fé Representações";
      renderNotFound();
    }
  }

  async function refreshProducts() {
    state.products = await CatalogStore.list();
  }

  async function initialize() {
    state.industries = loadIndustries();
    app.innerHTML =
      '<main class="page-main"><section class="catalog-section"><div class="container">' +
      emptyStateMarkup(
        "Preparando o catálogo",
        "Carregando os produtos compartilhados.",
        "",
      ) +
      "</div></section></main>";

    confirmDialog.addEventListener("close", function () {
      if (
        confirmDialog.returnValue === "confirm" &&
        confirmDialog.dataset.action === "remove"
      ) {
        removeConfirmedProduct();
      } else {
        state.removeId = null;
      }
      confirmDialog.dataset.action = "";
    });

    try {
      await refreshProducts();
      renderRoute();
    } catch (error) {
      app.innerHTML =
        '<main class="page-main"><section class="catalog-section"><div class="container">' +
        emptyStateMarkup(
          "Não foi possível abrir o catálogo",
          "Recarregue a página. Se o problema continuar, verifique as permissões de armazenamento do navegador.",
          "",
        ) +
        "</div></section></main>";
    }

    window.addEventListener("hashchange", async function () {
      await refreshProducts();
      renderRoute();
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  initialize();
})();
